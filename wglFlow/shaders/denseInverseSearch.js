const disSearchSource = `#version 310 es
layout(local_size_x = 32, local_size_y = 32) in;

layout(binding = 0) uniform highp sampler2D lastColorMap;
layout(binding = 1) uniform highp sampler2D nextColorMap;

layout(binding = 0, rgba32f) readonly uniform highp image2D lastGradientMap;
layout(binding = 1, rgba32f) readonly uniform highp image2D flowMap;
layout(binding = 2, rgba32f) writeonly uniform highp image2D sparseFlowMap;

layout(binding = 3, rgba32f) writeonly uniform highp image2D flowToWipe;


float luminance(vec3 color)
{
  return (0.299f * float(color.x) + 0.587f * float(color.y) + 0.114f * float(color.z));
}

float uluminance(vec3 color)
{
  return (0.299f * float(color.x) + 0.587f * float(color.y) + 0.114f * float(color.z));
}

uniform float level;
uniform vec2 invImageSize;
uniform vec2 invPreviousImageSize;

float INF = 1e10f;
float EPS = 0.001f;

void main()
{
    ivec2 pixSparse = ivec2(gl_GlobalInvocationID.xy);
	vec2 denseTexSize = vec2(textureSize(lastColorMap, int(level)).xy);

	ivec2 pix = (pixSparse * ivec2(4, 4));
	vec2 pixCenter = vec2(pix) + 0.5f;

	float lastImageData[8][8];
	float nextImageData[8][8];

	vec2 gradData[8][8];

	float templateSum = 0.0f;
	vec2 gradSum = vec2(0.0f);

	float patchSize = 8.0f;

	mat2 H = mat2(0.0f);

	for (int i = 0; i < int(patchSize); i++)
	{
		for (int j = 0; j < int(patchSize); j++)
		{
		
			imageStore(flowToWipe, ivec2(pix) + ivec2(i, j), vec4(0.0f));
			gradData[i][j] = -imageLoad(lastGradientMap, ivec2(pix) + ivec2(i, j)).xy;
		
			H[0][0] += gradData[i][j].x * gradData[i][j].x;
			H[1][1] += gradData[i][j].y * gradData[i][j].y;
			H[0][1] += gradData[i][j].x * gradData[i][j].y;

			lastImageData[i][j] = uluminance(textureLod(lastColorMap, (vec2(pixCenter + vec2(i, j))) * invImageSize, level).xyz);

			templateSum += lastImageData[i][j];
			gradSum += gradData[i][j].xy;
		}
	}
	
	H[1][0] = H[0][1];

	if (determinant(H) < 1e-6) 
	{
		H[0][0] += 1e-6;
		H[1][1] += 1e-6;
	}
	
	mat2 H_inv = inverse(H);

	vec4 initialFlow = imageLoad(flowMap, pix / 2);
	
	if (!isnan(initialFlow.z) || initialFlow.z != 0.0f || isinf(initialFlow.z))
	{
		initialFlow.xy /= initialFlow.z;
	}

	//initialFlow.xy *= (denseTexSize * invPreviousImageSize);

	if (any(isnan(initialFlow.xy)))
	{
		initialFlow.xy = vec2(0.0f);
	}

	initialFlow.xy *= denseTexSize;

	vec2 flow = initialFlow.xy;

	float meanDiff, firstMeanDiff;

	for (int iter = 0; iter < int(level + 2.0f); iter++)
	{
		vec2 du = vec2(0.0f);
		float warpedSum = 0.0f;
		vec2 flowNorm = flow * invImageSize;

		for (int i = 0; i < int(patchSize); i++)
		{
			for (int j = 0; j < int(patchSize); j++)
			{
				vec2 tc = pixCenter + vec2(i, j); 
				float warped = uluminance(textureLod(nextColorMap, vec2(tc  * invImageSize) + flowNorm, level).xyz);
				du += gradData[i][j] * (warped - lastImageData[i][j]);
				warpedSum += warped;

			}
		}

		meanDiff = (warpedSum - templateSum) * (1.0f / float(patchSize * patchSize));
		du -= gradSum * meanDiff;

		if (iter == 0)
		{
			firstMeanDiff = meanDiff;
		}

		flow -= H_inv * du;

	} // loop

	vec2 newPatchCenter = (vec2(pix) + 0.5f) + patchSize * 0.5f + flow;

    if (length(flow - initialFlow.xy) > (patchSize * 0.5f) ||
        newPatchCenter.x < -(patchSize * 0.5f) ||
        denseTexSize.x - newPatchCenter.x < -(patchSize * 0.5f) ||
        newPatchCenter.y < -(patchSize * 0.5f) ||
        denseTexSize.y - newPatchCenter.y < -(patchSize * 0.5f)) {
            flow = initialFlow.xy;
            meanDiff = firstMeanDiff;
    }
	
    // NOTE: The mean patch diff will be for the second-to-last patch,
    // not the true position of du. But hopefully, it will be very close.
    flow *= invImageSize;

	imageStore(sparseFlowMap, pixSparse, vec4(flow, meanDiff, 1.0f));

    //out_flow = vec3(u.x, u.y, mean_diff);
}
`;

const disDensificationVertexShaderSource = `#version 310 es
flat out vec4 flow;

layout(binding = 0, rgba32f) readonly uniform highp image2D sparseFlowMap;

uniform float level;
uniform vec2 invDenseTexSize;
uniform ivec2 sparseTexSize;

// using point sprites, we are going to splat at patch centers into the framebuffer which is set to blend whatever is already in the framebuffer
void main()
{
	int idx = gl_VertexID;

	ivec2 sparseCoord = ivec2(
		idx % sparseTexSize.x,
		idx / sparseTexSize.x
		);

	// clip space
	gl_Position = 2.0f * (vec4((float(sparseCoord.x) * 4.0f + 4.0f) * invDenseTexSize.x,
					   (float(sparseCoord.y) * 4.0f + 4.0f) * invDenseTexSize.y,
						0.0f, 1.0f)) - 1.0f;

	gl_PointSize = 8.0f;

	flow = imageLoad(sparseFlowMap, sparseCoord);
}
`;
   
const disDensificationFragmentShaderSource = `#version 310 es
precision highp float;

uniform float level;
uniform vec2 invDenseTexSize;

flat in vec4 flow; // flow.xy, meanDiff.z

out vec4 flow_contribution;

layout(binding = 0) uniform highp sampler2D lastImage;
layout(binding = 1) uniform highp sampler2D nextImage;

float uluminance(vec3 rgb)
{
    return (0.299f * float(rgb.x) + 0.587f * float(rgb.y) + 0.114f * float(rgb.z));
}

void main()
{         
	float diff = uluminance(textureLod(lastImage, vec2(gl_FragCoord.xy) * invDenseTexSize, level).xyz) - uluminance(textureLod(nextImage, vec2(gl_FragCoord.xy * invDenseTexSize) + flow.xy, level).xyz);
	diff -= flow.z;
	float weight = 1.0f / max(abs(diff), 1.0f);
	flow_contribution = vec4(flow.x * weight, flow.y * weight, weight, 1.0f);
}
`;