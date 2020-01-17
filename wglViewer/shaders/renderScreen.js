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
        uniform mat4 proj;
        uniform mat4 MV;

        void main()
        {
        v_texcoord = in_texcoord.xyz;
        gl_Position = proj * MV * vec4(position.x * 10.0, position.y*10.0, position.z*10.0, 1.0);
        }

`
;

const fragmentShaderSource = `#version 310 es

        precision highp float;
        precision highp int;
        precision highp sampler3D;

        layout(binding = 0) uniform highp sampler3D volumeData;

        in vec3 v_texcoord;

        out vec4 color;

        void main()
        {
            color = texture(volumeData, v_texcoord);
            color.xyz *= 0.001f;
        }
`
;
