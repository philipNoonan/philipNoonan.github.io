const vertexShaderSource = `#version 310 es
    in vec2 v;
    out vec2 t;
    out vec2 t_image;
    uniform vec2 imageSize;

    void main(){
    gl_Position = vec4(v.x * 2.0 - 1.0, 1.0 - v.y * 2.0, 0, 1);
    t = v;
    t_image = v * imageSize;
    }
   `;
   
const fragmentShaderSource = `#version 310 es
    precision mediump float;

    layout (binding = 0) uniform highp sampler2D depth;
    layout (binding = 1) uniform highp sampler2D colorMap;
    layout (binding = 2) uniform highp sampler2D refNormalMap;
    layout (binding = 3) uniform highp sampler2D refVertexMap;
    layout (binding = 4) uniform highp sampler2D normalMap;
    layout (binding = 5) uniform highp sampler2D vertexMap;
    layout (binding = 5) uniform highp sampler2D indexMap;

    // layout(binding = 0, rgba8ui) readonly uniform mediump uimage2D colorMap;
    // layout(binding = 1, rgba32f) readonly uniform mediump image2D refNormalMap;
    // layout(binding = 2, rgba32f) readonly uniform mediump image2D refVertexMap;
    // layout(binding = 3, rgba32f) readonly uniform mediump image2D normalMap;
    // layout(binding = 4, rgba32f) readonly uniform mediump image2D vertexMap;
    // layout(binding = 5, r32f) readonly uniform mediump image2D indexMap;


    uniform int renderOptions;
    in vec2 t;
    in vec2 t_image;
    out vec4 outColor;
    void main(){
    
    int renderDepth = (renderOptions & 1);
    int renderColor = (renderOptions & 2) >> 1;
    int renderRefNorm = (renderOptions & 4) >> 2;
    int renderRefVert = (renderOptions & 8) >> 3;
    int renderNorm = (renderOptions & 16) >> 4;
    int renderVert = (renderOptions & 32) >> 5;


    if (renderDepth == 1)
    {
        vec4 depthData = vec4(texture(depth, t));
        outColor = vec4(depthData.x * 10.0f, depthData.x * 10.0f, depthData.x * 10.0f, 1.0f);
    }

    if (renderColor == 1)
    {
        //vec4 col = vec4(imageLoad(colorMap, ivec2(t_image + 0.5f)));
        vec4 col = vec4(texture(colorMap, t));

        outColor = vec4(col.xyz, 1.0f);
    }

    if (renderRefNorm == 1)
    {
        //vec4 refNormsData = vec4(imageLoad(refNormalMap, ivec2(t_image + 0.5f)));
        vec4 refNormsData = vec4(texture(refNormalMap, t));

        if (abs(refNormsData.x) > 0.0f)
        {
            outColor = vec4(abs(refNormsData.xyz), 1.0f);
        }
    }

    if (renderRefVert == 1)
    {
       // vec4 refVertsData = vec4(imageLoad(refVertexMap, ivec2(t_image + 0.5f)));
        vec4 refVertsData = vec4(texture(refVertexMap, t));

        outColor = vec4(abs(refVertsData.xyz), 1.0f);

        //outColor = vec4(texture(indexMap, t));

    }

    if (renderNorm == 1)
    {
        //vec4 normsData = vec4(imageLoad(normalMap, ivec2(t_image + 0.5f)));
        vec4 normsData = vec4(texture(normalMap, t));

        if (abs(normsData.x) >= 0.0f)
        {
            outColor = vec4(abs(normsData.xyz), 1.0f);
        }
    }

    if (renderVert == 1)
    {
        //vec4 vertsData = vec4(imageLoad(vertexMap, ivec2(t_image + 0.5f)));
        vec4 vertsData = vec4(texture(vertexMap, t));

        outColor = vec4(abs(vertsData.xyz), 1.0f);
    }

    
   //outColor = vec4(smoothStep(imageLoad(indexMap, ivec2(t_image * 4.0f)).x, 0, 5e6), 0, 0, 1);

  // vec4 refVertsData = vec4(imageLoad(refVertexMap, ivec2(t_image + 0.5f)));
  // outColor = vec4(abs(refVertsData.xyz), 1.0f);

  }
  `;