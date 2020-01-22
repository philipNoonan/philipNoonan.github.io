const vertexShaderSource = `#version 310 es

#define POSITION_LOCATION 0
        #define TEXCOORD_LOCATION 1

        precision highp float;
        precision highp int;

        layout(location = POSITION_LOCATION) in vec3 position;
        layout(location = TEXCOORD_LOCATION) in vec3 in_texcoord;

        // Output 3D texture coordinate after transformation
        out vec3 v_texcoord;

        // Matrix to transform the texture coordinates into 3D space
        uniform mat4 orientation;
        uniform mat4 MVP;
        uniform vec3 pixDims;
        uniform vec3 volRatio;

        void main()
        {
            v_texcoord = in_texcoord.xyz;
            gl_Position = MVP * vec4(position.xyz * pixDims, 1.0);
        }

`
;

const fragmentShaderSource = `#version 310 es

        precision highp float;
        precision highp int;
        precision highp sampler3D;

        layout(binding = 0) uniform highp sampler3D volumeData;

        uniform float colorScale;

        in vec3 v_texcoord;

        out vec4 color;

        uvec2 unpack(uint val)
        {
            return uvec2((val & 4294901760u) >> 16, (val & 65535u));
        }

        void main()
        {
            //uint data = textureLod(volumeData, v_texcoord, 8.0f).x;
            //color = vec4(data * 1000u, 0, 0, 1);

            color = texture(volumeData, v_texcoord);
            if (color.x < 0.0001f)
            {
                discard;
                color.w = 0.0f;
            }
            color.xyz *= colorScale;
        }
`
;
