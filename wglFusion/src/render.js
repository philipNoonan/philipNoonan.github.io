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
    layout (binding = 1) uniform highp sampler2D norms;

    in vec2 t;
    out vec4 outColor;
    void main(){
    vec4 depthData = vec4(texture(depth, t));
    vec4 normalsData = vec4(texture(norms, t));

    outColor = vec4(depthData.x, depthData.x, depthData.x, 1.0f);

    if (abs(normalsData.x) > 0.0f)
    {
        outColor = vec4(abs(normalsData.xyz), 1.0f);
    }
  }
  `;