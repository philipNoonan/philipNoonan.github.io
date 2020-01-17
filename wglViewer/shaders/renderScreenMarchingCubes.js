const mcVertexShaderSource = `#version 310 es
    precision highp float;
    precision highp int;

    layout(location = 0) in vec4 positionMC;
    layout(location = 1) in vec4 normalMC;

    uniform float MCScaleFactor;
    uniform mat4 MVP;

    out vec3 TexCoord3D;
    out vec3 Normal;

    void main()
    {
        //vec3 vertPoint = 128.0f + (MCScaleFactor *  vec3((positionMC & 1072693248u) >> 20u, (positionMC & 1047552u) >> 10u, positionMC & 1023u));
        vec3 vertPoint = vec3(positionMC.xyz);

        Normal = normalMC.xyz;
        TexCoord3D = vertPoint / 256.0f;
        gl_Position = vec4(MVP * vec4((vertPoint - vec3(256.0f)) / 32.0f, 1.0f));

    }
`
;

const mcFragmentShaderSource = `#version 310 es
    precision highp float;
    precision highp int;
    precision highp sampler3D;
    
    uniform highp usampler3D volumeData;
    in vec3 TexCoord3D;
    in vec3 Normal;
    
    out vec4 color;
    
    void main()
    {

//         // ambient
// 	float ambientStrength = 0.1f;
// 	vec3 ambient = ambientStrength * vec3(1.0f);
// // diffuse
vec3 norm = normalize(Normal);
// 	vec3 lightDir = normalize(lightPos - FragPos);
// 	float diff = max(dot(norm, lightDir), 0.0);
// 	vec3 diffuse = diff * lightColor;
// //specular
// 	float specularStrength = 0.5;
// 	vec3 viewDir = normalize(view[3].xyz - FragPos);
// 	vec3 reflectDir = reflect(-lightDir, norm);
// 	float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32);
// 	vec3 specular = specularStrength * spec * lightColor;


        //color = vec4(norm * (ambient + diffuse),1.0f);
        
        color = vec4(smoothstep(-1.0, 1.0, TexCoord3D), 1.0f);
        //color = vec4(1.0f);

    }
`
;
