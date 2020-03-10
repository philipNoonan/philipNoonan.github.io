const alignDepthColorSource = `#version 310 es

layout(local_size_x = 32, local_size_y = 32) in;

// bind images
layout(binding = 0, rgba32f) readonly uniform highp image2D srcVertexMap;
layout(binding = 1, rgba8ui) readonly uniform highp uimage2D srcColorMap;
layout(binding = 2, rgba8ui) writeonly uniform highp uimage2D dstColorMap;

layout(binding = 3, rgba16ui) writeonly uniform highp uimage2D mappingC2DMap;
layout(binding = 4, rgba16ui) writeonly uniform highp uimage2D mappingD2CMap;

uniform int functionID;
uniform mat4 d2c;
uniform vec4 cam;


vec3 projectPointImage(vec3 p)
{
    return vec3(((cam.z * p.x) / p.z) + cam.x,
                ((cam.w * p.y) / p.z) + cam.y,
                p.z);
}

void wipeMapping()
{
	ivec2 pix = ivec2(gl_GlobalInvocationID.xy);
	imageStore(mappingC2DMap, pix, uvec4(0)); // a large number?
 	imageStore(mappingD2CMap, pix, uvec4(0)); // a large number?
}

void align()
{
	ivec2 pix = ivec2(gl_GlobalInvocationID.xy);
	//imageStore(mappingMap, ivec2(pix.xy), uvec4(10000, 0, 0, 0));

	vec4 vertex = imageLoad(srcVertexMap, pix);

	vec4 vertexInColor = d2c * vertex;

	vec3 colPix = projectPointImage(vertexInColor.xyz);

	if (vertex.z == 0.0f || isnan(vertex.z))
	{
		imageStore(dstColorMap, pix, uvec4(255)); 
		return;
	}
	if (any(lessThan(colPix.xy, vec2(0))) || any(greaterThan(colPix.xy, vec2(imageSize(srcColorMap).xy))))
	{
		imageStore(dstColorMap, pix, uvec4(0,0,0,255)); 

	}
	else
	{
		imageStore(dstColorMap, pix, imageLoad(srcColorMap, ivec2(colPix.x + 0.5f, colPix.y + 0.5f))); 
		//imageStore(dstColorMap, pix, uvec4(colPix.xy / 2.0f, 0, 255)); 

		// when this is a blank mapping pixel, both prev will be uvec4(0)
		// when some other invocation has written to either pixel, it will contain a uvec4(color, depth)
		//uvec4 prevPix = imageLoad(mappingMap, ivec2(pix));
		//uvec4 prevColPix = imageLoad(mappingMap, ivec2(colPix.xy));

		//if (prevPix.x == 10000)
		//{
		//	imageStore(mappingMap, ivec2(pix.xy), uvec4(colPix.xy, pix.xy));
		//	imageStore(mappingMap, ivec2(colPix.xy), uvec4(colPix.xy, pix.xy));
		//}
		//else
		//{
			imageStore(mappingD2CMap, ivec2(pix.xy), uvec4(colPix.xy, 0, 0));
			imageStore(mappingC2DMap, ivec2(colPix.xy), uvec4(pix.xy, 0, 0));
		//}



	}
	


	//imageStore(dstColorMap, pix, vec4(vertex.xyz, 1.0f)); 
}


void main()
{
	if (functionID == 0)
	{
		wipeMapping();
	}
	else if (functionID == 1)
	{
		align();
	}



}

`;
