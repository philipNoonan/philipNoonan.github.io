const updateGlobalMapSource = `#version 310 es
layout(local_size_x = 32, local_size_y = 32) in;

layout(binding = 0, r32f) readonly uniform highp image2D indexMap;	// Index map
layout(binding = 1, rgba32f) readonly uniform highp image2D mVertMap;	// Vertex map (measured)
layout(binding = 2, rgba32f) readonly uniform highp image2D mNormMap;	// Normal map (measured)
layout(binding = 3, rgba8) readonly uniform highp image2D mColorMap;	// RGBA color map (measured) 
//layout(binding = 4, rgba8) readonly uniform highp image2D mTrackStatusmap; // vertex tracking status (calculated)

//layout (binding = 5, rgba32f) writeonly uniform highp image2D statusMap;	// Dynamics status map

layout(binding = 0, offset = 0) uniform atomic_uint g_idx;

uniform mat4 T;		// Transformation from the sensor to the world
uniform mat4 invT;	// Transformation from the world to the sensor
uniform mat4 K;
uniform int timestamp;
uniform float sigma;
uniform uint maxMapSize;
uniform float c_stable;	// points with "c >= c_stable" are considered stable
uniform int firstFrame;

const float radThresh = 0.2588190451f;	// cos(PI * 75.0 / 180.0)
const float PI = 3.1415927f;
const float PI_2 = PI / 2.0;
const float sqrt2 = 1.41421356237f;


// Data structure
struct gMapData
{
	vec4 data;	// Confidence, radius, timestamp, timeFirstSeen 
	vec4 vert;	// Vertex
	vec4 norm;	// Normal
	vec4 color;	// Color
};

// Distance global map
layout(std430, binding = 0) buffer gMap
{
	gMapData elems[];
};

float getRadius(float depth, float norm_z, float camz, float camw)
{
    float meanFocal = ((1.0f / abs(camz)) + (1.0f / abs(camw))) / 2.0f;
    
    float radius = (depth / meanFocal) * sqrt2;

    float radius_n = radius;

    radius_n = radius_n / abs(norm_z);

    radius_n = min(2.0f * radius, radius_n);

    return radius_n;
}

// Ref: In-hand Scanning with Online Loop Closure
float calcRadius(float fx, float fy, float z, float n_z)
{
	return (n_z > radThresh) ? -1.0f : sqrt(2.0f) * z / (0.5f * (fx + fy));	// ref: InfiniTAM
	//max(abs(n_z), radThresh);
	//return z / (sqrt(2.0) * fx * max(abs(n_z), radThresh));	// Does not exeed 75 deg.
}

// Ref: Modeling Kinect Sensor Noise for Improved 3D Reconstruction and Tracking
float calcSigmaDepth(float z, float theta)
{
	return 0.0012f + 0.0019f * pow(z - 0.04f, 2.0f) + 0.0001f * pow(theta, 2.0f) / (sqrt(z) * (pow(PI_2 - theta, 2.0f)));
}

// https://www.intel.com/content/dam/support/us/en/documents/emerging-technologies/intel-realsense-technology/BKMs_Tuning_RealSense_D4xx_Cam.pdf
// not sure if this is correctly implemeted, in fact it is probably not even close to doing anything remotley useful
float calcSigmaDepthRealsense(float z, ivec2 uv, float baseline)
{
	return (pow(z, 2.0f) * float(sqrt(pow(float(uv.x) - K[2][0], 2.0f) + pow(float(uv.y) - K[2][1], 2.0f)))) / (K[0][0] * baseline);
}

float calcTheta(vec2 uv, float f, vec2 optCenter)
{
	return acos(f / length(vec3(uv - optCenter, f)));
}

vec3 calcWeightedAvg(vec3 v_g, vec3 v_c, float conf, float alpha)
{
	if (v_g == vec3(0.0f))
	{
		return v_c;
	}
	
	if (v_c == vec3(0.0f))
	{
		return v_g;
	}

	return (conf * v_g + alpha * v_c) / (conf + alpha);
}
float calcWeightedAvg(float a, float b, float conf, float alpha)
{
	return (conf * a + alpha * b) / (conf + alpha);
}

float calcLuminance(vec3 col)
{
	return 0.114f * col.x + 0.299f * col.y + 0.587f * col.z;
}

bool closeEachOther(int idxSelect, int idxCandi)
{
	float distV = length(elems[idxSelect].vert.xyz - elems[idxCandi].vert.xyz);
	float distN = dot(elems[idxSelect].norm.xyz, elems[idxCandi].norm.xyz);
	float distR = abs(elems[idxSelect].data.y - elems[idxCandi].data.y);
	float distC = abs(calcLuminance(elems[idxSelect].color.xyz) - calcLuminance(elems[idxCandi].color.xyz));

	// NOTE: I'm not sure if these parameters are proper or not...
	if (distV <= 0.05f && distN > 0.9f && distR < 1.4f && distC > 0.85f) 
	{
		return true;
	}
	else
	{
		return false;
	}
}

void removePoint(inout int idx)
{
	//elems[idx].vert = vec4(0.0, 0.0, 0.0, 0.0);
	//elems[idx].norm = vec4(0.0, 0.0, 0.0, 0.0);
	//elems[idx].color = vec4(0.0, 0.0, 0.0, 0.0);
	//elems[idx].data.x = -1.0f;	// confidence
	elems[idx].data.y = -1.0f;	// radius
	//elems[idx].data.z = -1.0f;	// timestamp

	idx = -1;
}
void mergeAndRemove(int idxSelect, inout int idxCandi)
{

	elems[idxSelect].vert = vec4(calcWeightedAvg(elems[idxSelect].vert.xyz, elems[idxCandi].vert.xyz, elems[idxSelect].data.x, elems[idxCandi].data.x), 1.0f);
	elems[idxSelect].norm.xyz = normalize(calcWeightedAvg(elems[idxSelect].norm.xyz, elems[idxCandi].norm.xyz, elems[idxSelect].data.x, elems[idxCandi].data.x));
	elems[idxSelect].color = vec4(calcWeightedAvg(elems[idxSelect].color.rgb, elems[idxCandi].color.rgb, elems[idxSelect].data.x, elems[idxCandi].data.x), 1.0f);

	elems[idxSelect].data.y = calcWeightedAvg(elems[idxSelect].data.y, elems[idxCandi].data.y, elems[idxSelect].data.x, elems[idxCandi].data.x);
	elems[idxSelect].data.x = max(elems[idxSelect].data.x, elems[idxCandi].data.x);
	elems[idxSelect].data.z = max(elems[idxSelect].data.z, elems[idxCandi].data.z);

	removePoint(idxCandi);
}


void main(void)
{
	ivec2 uv = ivec2(gl_GlobalInvocationID.xy);
	// current vertex and normal
	vec3 inputVert = vec3(imageLoad(mVertMap, uv).xyz);
	vec3 inputNorm = vec3(imageLoad(mNormMap, uv).xyz);
	vec3 inputColor = vec3(imageLoad(mColorMap, uv).rgb);	// Note: Assuming "BGR" input
	//vec4 status = imageLoad(mTrackStatusmap, uv).xyzw;
	ivec2 bestPix;

	if (firstFrame == 1)
	{

		ivec2 res = imageSize(mVertMap);
		vec2 res_2 = vec2(res) / 2.0f;
		float gamma = length(vec2((float(uv.x) - K[2][0]) / res_2.x, (float(uv.y) - K[2][1]) / res_2.y));
		float alpha = exp(-pow(gamma, 2.0f) / (2.0f * pow(sigma, 2.0f)));
		float rad = getRadius(inputVert.z, inputNorm.z, 1.0f / K[0][0], 1.0f / K[1][1]);

		uint idx = atomicCounterIncrement(g_idx);

        // elems[idx].vert = T * vec4(inputVert, 1.0f);
		// elems[idx].norm = vec4(5, 6, 7, 8);
		// elems[idx].color = vec4(9, 10, 11, 12);
		// elems[idx].data.x = 13.0f;		// confidence
		// elems[idx].data.y = 14.0f;		// radius
		// elems[idx].data.z = 15.0f;	// timestamp
        // elems[idx].data.w = 16.0f;	// timestamp
        
		elems[idx].vert = T * vec4(inputVert, 1.0f);
		elems[idx].norm = vec4(inputNorm.xyz, 0.0);//vec4(mat3(T) * inputNorm, 0.0f);
		elems[idx].color = vec4(inputColor, 1.0f);
		elems[idx].data.x = alpha * 10.0f;		// confidence
		elems[idx].data.y = rad;		// radius
		elems[idx].data.z = float(timestamp);	// timestamp
		elems[idx].data.w = float(timestamp);	// timestamp
	
	}
	else
	{
	if (inputVert.z > 0.0f && inputNorm.z < 0.0f) // should this have to be negative z for the norm?
	{
		// -----
		// ----- INTEGRATING NEW POINTS
		// -----
		// Point selection
		int idxSelect = -1;
		float tmpConf = -1.0f;
		//float sigma_depth = 0.05f;//calcSigmaDepth(inputVert.z, calcTheta(uv, K[0][0], vec2(K[2][0], K[2][1])));
		float sigma_depth = calcSigmaDepthRealsense(inputVert.z, uv, 0.05f);
		int idxCandi[16];
		
		vec3 _v[16];
		vec3 _n[16];

		float bestDist = 1000000.0f;

		for (int i = 0; i < 16; ++i)
		{
			// locally store the surrounding 16 pixels from the 4x index map
			idxCandi[i] = int(imageLoad(indexMap, ivec2(uv.x * 4 + i % 4, uv.y * 4 + i / 4)));
			if (idxCandi[i] >= 0)
			{
				_v[i] = mat4x3(invT) * elems[idxCandi[i]].vert;
				// 4.1 Data Association: Condition #1
				float dist = abs(inputVert.z - _v[i].z);
				if (dist < sigma_depth)
				{
					_n[i] = mat3(invT) * elems[idxCandi[i]].norm.xyz;
					float candiConf = elems[idxCandi[i]].data.x;
					// 4.1 Data Association: Condition #2 & #3
					// cos(PI * 20.0 / 180.0) = 0.93969262078
					if (dot(inputNorm, _n[i]) > 0.93969262078f && candiConf > tmpConf && dist < bestDist)
					{
						// find the id of the closest points that are facing the same way (to 20 degrees)
						idxSelect = idxCandi[i];
						tmpConf = candiConf;
						bestDist = dist;
						bestPix = ivec2(uv.x * 4 + i % 4, uv.y * 4 + i / 4);
					}
				}
			}
		}

		// clean foreground objects when a background object is the only thing in the line of sight

		// MEMO: Do we REALLY need "4.1 Data Association: Condition #4"??

		ivec2 res = imageSize(mVertMap);
		vec2 res_2 = vec2(res) / 2.0f;
		float gamma = length(vec2((float(uv.x) - K[2][0]) / res_2.x, (float(uv.y) - K[2][1]) / res_2.y));
		float alpha = exp(-pow(gamma, 2.0f) / (2.0f * pow(sigma, 2.0f)));
		//float rad = calcRadius(K[0][0], K[1][1], inputVert.z, inputNorm.z);
		float rad = getRadius(inputVert.z, inputNorm.z, 1.0f / K[0][0], 1.0f / K[1][1]);


		// if we have found a vertex that is close to the input vertex
		if (idxSelect >= 0)
		{


			// merge the point with the vertex already in the global map 
			bool bAveraged = false;
			// if the radius of the input vertex is less than 1.5x of the global vertex radius, then it should be merged
			if (rad <= (1.0f + 0.5f) * elems[idxSelect].data.y)
			{
				elems[idxSelect].vert = vec4(calcWeightedAvg(elems[idxSelect].vert.xyz, mat4x3(T) * vec4(inputVert, 1.0f), elems[idxSelect].data.x, alpha), 1.0f);
				elems[idxSelect].norm.xyz = normalize(calcWeightedAvg(elems[idxSelect].norm.xyz, mat3(T) * inputNorm, elems[idxSelect].data.x, alpha));
				elems[idxSelect].color = vec4(calcWeightedAvg(elems[idxSelect].color.rgb, inputColor, elems[idxSelect].data.x, alpha), 1.0f);
				bAveraged = true;
			}
			elems[idxSelect].data.x += alpha;									// confidence
			if (rad < elems[idxSelect].data.y) elems[idxSelect].data.y = rad;	// radius
			elems[idxSelect].data.z = float(timestamp);								// timestamp

			// -----
			// ----- REMOVING POINTS
			// -----
			
			// 4.3 Removing points: Condition #1
			//     --> in "removePoints.comp"

			// if merging has occured, and the global vertex's onfidence is greater than the threshold
			if (elems[idxSelect].data.x >= c_stable)
			{



				
				// 4.3 Removing points: Condition #2
				// values here in depth space
				vec4 mergedDepthVec = invT * vec4(elems[idxSelect].vert.xyz, 1.0f);
				float mergedDepth = mergedDepthVec.z;

				float mergedNormZ = (mat3(invT) * elems[idxSelect].norm.xyz).z;


				for (int i = 0; i < 16; ++i)
				{
					if (idxCandi[i] >= 0 
						&& idxCandi[i] != idxSelect
						&& _v[i].z < mergedDepth
						&& abs(mergedNormZ) > 0.85f)
					{
						//imageStore(statusMap, ivec2((bestPix / 4.0f) + 0.5f), vec4(mergedDepth, _v[i].z, 0, 1));

						removePoint(idxCandi[i]);
					}
				}

				// 4.3 Removing points: Condition #3
				for (int i = 0; i < 16; ++i)
				{
					if (idxCandi[i] >= 0 && idxCandi[i] != idxSelect 
						&& closeEachOther(idxSelect, idxCandi[i]))
					{
						mergeAndRemove(idxSelect, idxCandi[i]);
					}
				}

				// Wheelan et al time condition, detect if time since last seen is > than some sensible threshold
				//for (int i = 0; i < 16; ++i)
				//{
				//	if (idxCandi[i] >= 0 && idxCandi[i] != idxSelect && 
				//		elems[idxCandi[i]].data.z - elems[idxCandi[i]].data.w > 20)
				//	{
				//		removePoint(idxCandi[i]);
				//	}
				//}

				

				
			}
		}
		// -----
		// ----- ADD NEW POINTS
		// -----
		else if (atomicCounter(g_idx) < maxMapSize) // New points
		{
			uint idx = atomicCounterIncrement(g_idx);
			elems[idx].vert = T * vec4(inputVert, 1.0f);
			elems[idx].norm = vec4(mat3(T) * inputNorm, 0.0f);
			elems[idx].color = vec4(inputColor, 1.0f);
			elems[idx].data.x = alpha;		// confidence
			elems[idx].data.y = rad;		// radius
			elems[idx].data.z = float(timestamp);	// timestamp
			elems[idx].data.w = float(timestamp);	// timestamp

		}
	}
	}

	
}


`;


const removeUnnecessaryPointsSource = `#version 310 es

layout(binding = 1, offset = 0) uniform atomic_uint g_idxDst;

// Data structure
struct gMapData
{
	vec4 data;	// Confidence, radius, timestamp, and empty data 
	vec4 vert;	// Vertex
	vec4 norm;	// Normal
	vec4 color;	// Color
};
// Global map (source)
layout(std430, binding = 0) buffer gMapSrc
{
	gMapData elemSrc[];
};
// Global map (distination; removed)
layout(std430, binding = 1) buffer gMapDst
{
	gMapData elemDst[];
};

layout(local_size_x = 400, local_size_y = 1) in;

uniform float c_stable;
uniform int timestamp;

bool validPoint(uint idx)
{
	if (elemSrc[idx].data.y > 0.0)
	{
		// 4.3 Removing points: Condition #1
		if (elemSrc[idx].data.x < c_stable
			&& float(timestamp) - elemSrc[idx].data.z > 30.0f)
		{
			return false;
		}
		else
		{
			return true;
		}
	}
	else
	{
		return false;
	}
}
void setPoint(uint idxSrc, uint idxDst)
{
	elemDst[idxDst].data = elemSrc[idxSrc].data;
	elemDst[idxDst].vert = elemSrc[idxSrc].vert;
	elemDst[idxDst].norm = elemSrc[idxSrc].norm;
	elemDst[idxDst].color = elemSrc[idxSrc].color;
}

void main(void)
{
	uint idxSrc = gl_GlobalInvocationID.x;
	if (validPoint(idxSrc))
	{
		uint idxDst = atomicCounterIncrement(g_idxDst);
		setPoint(idxSrc, idxDst);
	}
}

`;
