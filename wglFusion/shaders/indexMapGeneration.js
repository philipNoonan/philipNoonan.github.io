const indexMapGenVertexShaderSource = `#version 310 es
// Data structure
struct gMapData
{
	vec4 data;	// Confidence, radius, timestamp, and empty data 
	vec4 vert;	// Vertex
	vec4 norm;	// Normal
	vec4 color;	// Color
};
// Distance global map
layout(std430, binding = 0) buffer gMap
{
	gMapData elems[];
};
uniform mat4 invT;
uniform mat4 P;

uniform vec2 imSize;
uniform vec4 cam;
uniform float maxDepth;

flat out int idx;

vec3 projectPoint(vec3 p)
{
    return vec3(((((cam.z * p.x) / p.z) + cam.x) - (imSize.x * 0.5f)) / (imSize.x * 0.5f),
                ((((cam.w * p.y) / p.z) + cam.y) - (imSize.y * 0.5f)) / (imSize.y * 0.5f),
                p.z / maxDepth);
}

vec3 projectPointImage(vec3 p)
{
    return vec3(((cam.z * p.x) / p.z) + cam.x,
                ((cam.w * p.y) / p.z) + cam.y,
                p.z);
}
vec4 transPtForGL(vec4 v)
{
	v = invT * v;
	return vec4(projectPoint(vec3(v.xy, v.z)), 1.0f);
}

void main()
{
	idx = gl_VertexID;

	vec4 tempPos = transPtForGL(elems[idx].vert);

	if (tempPos.z < 0.0f)
	{
		gl_Position = vec4(10000,10000,0,0);
	}
	else
	{
		gl_Position = tempPos;
	}

	// gl_Position = vec4(elems[idx].vert.x, elems[idx].vert.y, 0, 1);
	gl_PointSize = 10.0f;

	
}
   `;
   
const indexMapGenFragmentShaderSource = `#version 310 es
precision highp float;

flat in int idx;

layout(location = 0) out vec4 outIndex;

void main()
{
    outIndex = vec4(float(idx));
}
`;