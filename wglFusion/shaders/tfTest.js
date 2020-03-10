const tfTestVertexShaderSource = `#version 310 es

out float iddy;

    void main()
    {
        int idx = gl_VertexID;

        if (idx > 16)
        {
            gl_Position = vec4(-0.5 + float(idx) * 0.05f,0.5,0,1.0);
            iddy = float(idx);
        }
        else
        {
            gl_Position = vec4(-1000);
        }

        gl_PointSize = 5.0f;
    }
   `;
   
const tfTestFragmentShaderSource = `#version 310 es
    precision mediump float;

    out vec4 outColor;
    void main()
    {  
        outColor = vec4(0, 0, 1.0f, 1.0f);
    }
  `;