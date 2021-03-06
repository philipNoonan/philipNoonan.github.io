const p2vTrackSource = `#version 310 es
layout (local_size_x = 32, local_size_y = 32, local_size_z = 1) in;

// bind textures
layout(binding = 0) uniform highp sampler3D volumeDataTexture; 

// bind images
layout(binding = 0, rgba32f) readonly uniform highp image2D vertexMap;
layout(binding = 1, rgba32f) readonly uniform highp image2D normalMap;
layout(binding = 2, rgba32f) writeonly uniform highp image2D SDFImage;
layout(binding = 3, rgba8) writeonly uniform highp image2D trackImage;

uniform mat4 T;
uniform float volDim;
uniform float volSize; 
uniform int mip;

struct reduSDFType
{
    int result;
    float h;
    float D;
    float J[6];
};

layout(std430, binding = 0) buffer TrackData
{
    reduSDFType data[];
} trackOutput;



bool invalidGradient(float inputSDF)
{
    if (inputSDF <= -0.2f || inputSDF >= 0.2f || isnan(inputSDF))
    {
        return true;
    }
    return false;
}

float SDF(vec3 location, inout bool validGradient)
{
    validGradient = true;
    float i, j, k;
    float x, y, z;

    x = modf(location.x, i);
    y = modf(location.y, j);
    z = modf(location.z, k);

    int I = int(i);
    int J = int(j);
    int K = int(k);

    vec3 locationInVolumeTexture = vec3(location / volSize);
    
    float currSDF = float(textureLod(volumeDataTexture, locationInVolumeTexture, 0.0f).x);

    if (abs(currSDF) < 0.0001)
    {
        validGradient = false;
    }
    return currSDF;
}


float SDFGradient(vec3 location, vec3 location_offset, float numVoxels)
{
    float voxelLength = volDim / volSize;
  
    bool valGradUpper;
    bool valGradLower;
    float gradient;

    float upperVal = SDF(vec3(location.xyz + location_offset), valGradUpper);

    float lowerVal = SDF(vec3(location.xyz - location_offset), valGradLower);

    if (valGradUpper == false && valGradLower == true)
    {
        gradient = lowerVal;
    }
    else if (valGradUpper == true && valGradLower == false)
    {
        gradient = upperVal;
    }
    else if (valGradUpper == false && valGradLower == false)
    {
        gradient = -2.0f;
    }
    else
    {
        gradient = (upperVal - lowerVal) / (2.0f * voxelLength * numVoxels);
    }
    return gradient;



}

float[6] getJ(vec3 dsdf, float[3][6] dxdxi)
{
    float oJ[6];
    oJ[0] = dsdf.x * dxdxi[0][0] + dsdf.y * dxdxi[1][0] + dsdf.z * dxdxi[2][0];
    oJ[1] = dsdf.x * dxdxi[0][1] + dsdf.y * dxdxi[1][1] + dsdf.z * dxdxi[2][1];
    oJ[2] = dsdf.x * dxdxi[0][2] + dsdf.y * dxdxi[1][2] + dsdf.z * dxdxi[2][2];
    oJ[3] = dsdf.x * dxdxi[0][3] + dsdf.y * dxdxi[1][3] + dsdf.z * dxdxi[2][3];
    oJ[4] = dsdf.x * dxdxi[0][4] + dsdf.y * dxdxi[1][4] + dsdf.z * dxdxi[2][4];
    oJ[5] = dsdf.x * dxdxi[0][5] + dsdf.y * dxdxi[1][5] + dsdf.z * dxdxi[2][5];
    return oJ;
}


void main()
{
	uint numberOfCameras = 1u;
    uvec2 pix = gl_GlobalInvocationID.xy;
    ivec2 imSize = imageSize(vertexMap);

    for (uint camera = 0u; camera < numberOfCameras; camera++)
    { 
        imageStore(SDFImage, ivec2(pix), vec4(0.0, 0.0f, 0.0, 0.0));
        imageStore(trackImage, ivec2(pix), vec4(0.0f, 0.0, 0.0, 1.0));

        uint offset = uint(camera * uint(imSize.x) * uint(imSize.y)) + ((pix.y * uint(imSize.x)) + pix.x);
        trackOutput.data[offset].result = -4;

        //if (pix.x >= 0 && pix.x < imageSize.x - 1 && pix.y >= 0 && pix.y < imageSize.y)
        if (all(greaterThanEqual(pix, uvec2(0u))) && all(lessThan(pix, uvec2(imSize))))
        {
            vec4 normals = imageLoad(normalMap, ivec2(pix));

            if (normals.x == 2.0f)
            {
                trackOutput.data[offset].result = -4;
                imageStore(trackImage, ivec2(pix), vec4(0, 0, 0, 0));
            }
            else
            {

                vec4 cameraPoint = imageLoad(vertexMap, ivec2(pix));
                vec4 projectedVertex = T * vec4(cameraPoint.xyz, 1.0f);


                
                bool isInterpolated;
  
                // cvp is in texel space 0 - 127
                vec3 cvp = (volSize / volDim) * projectedVertex.xyz;

                if (any(lessThan(cvp, vec3(0.0f))) || any(greaterThan(cvp, vec3(volSize))))
                {
                    //imageStore(testImage, ivec2(pix), vec4(0.5f));
                    imageStore(trackImage, ivec2(pix), vec4(0.0f, 0.0f, 1.0, 1.0f));
                    trackOutput.data[offset].result = -4;

                    continue;
                }

                bool valSDF = true;
                float D = SDF(cvp.xyz, valSDF);
                vec3 dSDF_dx = vec3(SDFGradient(cvp, vec3(2, 0, 0), 2.0f), SDFGradient(cvp, vec3(0, 2, 0), 2.0f), SDFGradient(cvp, vec3(0, 0, 2), 2.0f));
                vec3 rotatedNormal = vec3(T * vec4(normals.xyz, 0.0f)).xyz;

                if (dot(dSDF_dx, rotatedNormal) < 0.8 && !any(equal(dSDF_dx, vec3(0.0f))))
                {
                    imageStore(trackImage, ivec2(pix), vec4(1.0f, 1.0f, 0, 1.0f));
                    trackOutput.data[offset].result = -4;
                    continue;
                }

                if (any(equal(dSDF_dx, vec3(-2.0f))))
                {
                    trackOutput.data[offset].result = -4;
                    imageStore(trackImage, ivec2(pix), vec4(1.0f, 0.0f, 0, 1.0f));
                    continue;
                }

                imageStore(SDFImage, ivec2(pix), vec4(dSDF_dx, 1.0f));

                float absD = abs(D);// get abs depth

				float dMin = -volDim / 20.0f;
				float dMax = volDim / 10.0f;

                if (D < dMax && D > dMin)
                {
                    vec3 nDSDF = normalize(dSDF_dx);

                    // 3 cols 6 rows 
                    float dx_dxi[3][6];

                    dx_dxi[0][0] = 0.0f;                   dx_dxi[1][0] = -projectedVertex.z;  dx_dxi[2][0] = projectedVertex.y;    
                    dx_dxi[0][1] = projectedVertex.z;   dx_dxi[1][1] = 0.0f;                   dx_dxi[2][1] = -projectedVertex.x; 
	                dx_dxi[0][2] = -projectedVertex.y;  dx_dxi[1][2] = projectedVertex.x;   dx_dxi[2][2] = 0.0f;  
                    dx_dxi[0][3] = 1.0f;	                dx_dxi[1][3] = 0.0f;                   dx_dxi[2][3] = 0.0f;
                    dx_dxi[0][4] = 0.0f;	                dx_dxi[1][4] = 1.0f;                   dx_dxi[2][4] = 0.0f;
                    dx_dxi[0][5] = 0.0f;	                dx_dxi[1][5] = 0.0f;                   dx_dxi[2][5] = 1.0f;

                    float J[6] = getJ(dSDF_dx, dx_dxi);

                    float huber = absD < 0.003f ? 1.0f : 0.003f / absD;

                    trackOutput.data[offset].result = 1;

                    trackOutput.data[offset].h = huber;
                    trackOutput.data[offset].D = D;
                    trackOutput.data[offset].J[0] = J[0];
                    trackOutput.data[offset].J[1] = J[1];
                    trackOutput.data[offset].J[2] = J[2];
                    trackOutput.data[offset].J[3] = J[3];
                    trackOutput.data[offset].J[4] = J[4];
                    trackOutput.data[offset].J[5] = J[5];

                    imageStore(trackImage, ivec2(pix), vec4(0.5f, 0.5f, 0.5f, 1.0f));             
                }
                else
                {
                    imageStore(trackImage, ivec2(pix), vec4(0.0, 0.0, 0.0f, 0.0f));

                    
                    trackOutput.data[offset].result = -4;
                    trackOutput.data[offset].h = 0.0f;
                    trackOutput.data[offset].D = 0.0f;
                    trackOutput.data[offset].J[0] = 0.0f;
                    trackOutput.data[offset].J[1] = 0.0f;
                    trackOutput.data[offset].J[2] = 0.0f;
                    trackOutput.data[offset].J[3] = 0.0f;
                    trackOutput.data[offset].J[4] = 0.0f;
                    trackOutput.data[offset].J[5] = 0.0f;

                }
            }   
        }
    }
}
    `;