const vertexShaderSource = `#version 310 es
    in vec2 v;
    out vec2 t;
    void main(){
    gl_Position = vec4(v.x * 2.0 - 1.0, 1.0 - v.y * 2.0, 0, 1);
    t = v;
    }
   `;
   
const fragmentShaderSource = `#version 310 es
    precision mediump float;
    layout (binding = 0) uniform highp sampler2D depth;
    layout (binding = 1) uniform highp sampler2D refNorms;
    layout (binding = 2) uniform highp sampler2D refVerts;
    layout (binding = 3) uniform highp sampler2D norms;
    layout (binding = 4) uniform highp sampler2D verts;

    uniform int renderOptions;
    in vec2 t;
    out vec4 outColor;
    void main(){
    
    int renderDepth = (renderOptions & 1);
    int renderRefNorm = (renderOptions & 2) >> 1;
    int renderRefVert = (renderOptions & 4) >> 2;
    int renderNorm = (renderOptions & 8) >> 3;
    int renderVert = (renderOptions & 16) >> 4;


    if (renderDepth == 1)
    {
        vec4 depthData = vec4(texture(depth, t));
        outColor = vec4(depthData.x, depthData.x, depthData.x, 1.0f);
    }

    if (renderRefNorm == 1)
    {
        vec4 refNormsData = vec4(texture(refNorms, t));
        if (abs(refNormsData.x) > 0.0f)
        {
            outColor = vec4(abs(refNormsData.xyz), 1.0f);
        }
    }

    if (renderRefVert == 1)
    {
        vec4 refVertsData = vec4(texture(refVerts, t));
        outColor = vec4(refVertsData.xyz, 1.0f);

    }

    if (renderNorm == 1)
    {
        vec4 normsData = vec4(texture(norms, t));
        if (abs(normsData.x) > 0.0f)
        {
            outColor = vec4(abs(normsData.xyz), 1.0f);
        }
    }

    if (renderVert == 1)
    {
        vec4 vertsData = vec4(texture(verts, t));
        outColor = vec4(vertsData.xyz, 1.0f);

    }


  }
  `;