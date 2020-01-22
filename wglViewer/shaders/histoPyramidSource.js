const constructHistoPyramidSource = `#version 310 es
layout(local_size_x = 8, local_size_y = 8, local_size_z = 8) in;

// This shader is called twice. Firstly we classify each voxel using classify cubes. 
// This takes the value at each corner of the voxel, and compares it to the threshold.
// The ouput of this stage is two numbers per voxel, whether the voxel is active,
// and the 0-255 cube index specifying the configuration of these vertices inside the active voxel
//
// The second call of this shader is to create the histopyramid by summing up the number of verts as outputted in the first call
// On the base level the texture is read as a two channel 16 bit float volume, but on higher levels
// we consider them as single channel 32 bit floats. This allows us to count more values than available in 16 bits

// images
layout(binding = 0, r32ui) uniform highp uimage3D volumeHPData;
layout(binding = 1, r32ui) uniform writeonly highp uimage3D volumeHPDataOutput;

layout(binding = 2, r32ui) uniform readonly highp uimage2D nrOfTriangles;


// textures
layout(binding = 0) uniform highp usampler3D histoPyramidTexture; 
layout(binding = 1) uniform highp sampler3D volumeFloatTexture; 

// uniforms
uniform int functionID;
uniform int hpLevel;
uniform float isoLevel;
uniform int maxLevel;

layout(std430, binding = 0) buffer outSum
{
  highp uint data;
} sumData;


uvec2 unpack(highp uint val)
{
    return uvec2((val & 4294901760u) >> 16u, (val & 65535u));
}

const ivec4 cubeOffsets[8] = ivec4[8](
    ivec4(0, 0, 0, 0),
    ivec4(1, 0, 0, 0),
    ivec4(0, 0, 1, 0),
    ivec4(1, 0, 1, 0),
    ivec4(0, 1, 0, 0),
    ivec4(1, 1, 0, 0),
    ivec4(0, 1, 1, 0),
    ivec4(1, 1, 1, 0)    
);


void classifyCubes()
{
    ivec3 pos = ivec3(gl_GlobalInvocationID.xyz);

    highp uint cubeIndex;
        
    float field[8];
    field[0] = texelFetch(volumeFloatTexture, pos, 0).x;
    field[1] = texelFetch(volumeFloatTexture, pos + ivec3(cubeOffsets[1].xyz), 0).x;
    field[2] = texelFetch(volumeFloatTexture, pos + ivec3(cubeOffsets[2].xyz), 0).x;
    field[3] = texelFetch(volumeFloatTexture, pos + ivec3(cubeOffsets[3].xyz), 0).x;
    field[4] = texelFetch(volumeFloatTexture, pos + ivec3(cubeOffsets[4].xyz), 0).x;
    field[5] = texelFetch(volumeFloatTexture, pos + ivec3(cubeOffsets[5].xyz), 0).x;
    field[6] = texelFetch(volumeFloatTexture, pos + ivec3(cubeOffsets[6].xyz), 0).x;
    field[7] = texelFetch(volumeFloatTexture, pos + ivec3(cubeOffsets[7].xyz), 0).x;

    // https://stackoverflow.com/questions/43769622/bit-manipulation-to-store-multiple-values-in-one-int-c
    cubeIndex = uint(field[0] < isoLevel);
    cubeIndex += uint(field[1] < isoLevel) * 2u;
    cubeIndex += uint(field[3] < isoLevel) * 4u;
    cubeIndex += uint(field[2] < isoLevel) * 8u;
    cubeIndex += uint(field[4] < isoLevel) * 16u;
    cubeIndex += uint(field[5] < isoLevel) * 32u;
    cubeIndex += uint(field[7] < isoLevel) * 64u;
    cubeIndex += uint(field[6] < isoLevel) * 128u;
    
    highp uint numTri = imageLoad(nrOfTriangles, ivec2(cubeIndex, 0)).x;
   
    imageStore(volumeHPDataOutput, pos, uvec4((numTri << 16u) | cubeIndex, 0, 0, 0)); 
}


void constructHPLevel()
{
    
    vec3 writePos = vec3(gl_GlobalInvocationID.xyz);

    ivec3 imSize = ivec3(0);

    imSize = imageSize(volumeHPDataOutput);
    
    if (writePos.x > float(imSize.x * 2) || writePos.y > float(imSize.y * 2) || writePos.z > float(imSize.z * 2))
    {
        return;
    }

    highp uint writeValue = 0u;

    // on level = zero, then we read from the texture view rg16ui texture, other levels we read from the r32ui texture. this is controled in c++ code
    

        //vec3 readPos = writePos * 2.0f + 1.0f;
        ivec3 readPos_t = ivec3(writePos * 2.0f);

        if (hpLevel == 0)
        {

            writeValue = unpack(texelFetch(histoPyramidTexture, readPos_t, 0).x).x +
            unpack(texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[1].xyz), 0).x).x +
            unpack(texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[2].xyz), 0).x).x +
            unpack(texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[3].xyz), 0).x).x +
            unpack(texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[4].xyz), 0).x).x +
            unpack(texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[5].xyz), 0).x).x +
            unpack(texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[6].xyz), 0).x).x +
            unpack(texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[7].xyz), 0).x).x;
        }
        else
        {
            writeValue = texelFetch(histoPyramidTexture, readPos_t, hpLevel).x +
            texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[1].xyz), hpLevel).x +
            texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[2].xyz), hpLevel).x +
            texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[3].xyz), hpLevel).x +
            texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[4].xyz), hpLevel).x +
            texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[5].xyz), hpLevel).x +
            texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[6].xyz), hpLevel).x +
            texelFetch(histoPyramidTexture, readPos_t + ivec3(cubeOffsets[7].xyz), hpLevel).x;

        }

        imageStore(volumeHPDataOutput, ivec3(writePos), uvec4(writeValue));

        if (hpLevel == maxLevel)
        {
            if (writeValue > 0u) // i think this is needed to stop the other invocations from overwriting the valid output, woudl it be better to check before this point???
            {
                sumData.data = writeValue;
            }
        }
    
}






void main()
{
    if (functionID == 0)
    {
        classifyCubes();
    }
    else if (functionID == 1)
    {
        constructHPLevel();
    }
}

`;

const traverseHistoPyramidSource = `#version 310 es
layout(local_size_x = 8, local_size_y = 1, local_size_z = 1) in;

uvec2 unpack(uint val)
{
    return uvec2((val & 4294901760u) >> 16, (val & 65535u));
}

float pack(vec3 data)
{
    highp uint uDataPacked = uint(data.x) << 20 | uint(data.y) << 10 | uint(data.z);
    return uintBitsToFloat(uDataPacked);
}

// images
layout(binding = 0, r32ui) uniform readonly highp uimage2D triTable;
layout(binding = 1, r32ui) uniform readonly highp uimage2D offsets3;

// textures
layout(binding = 0) uniform highp usampler3D histoPyramidTexture; 
layout(binding = 1) uniform highp sampler3D volumeFloatTexture; 




layout(std430, binding = 0) buffer posBufEncode
{
    float posEncode [];
};

// layout(std430, binding = 1) buffer normBuf
// {
//     vec4 norm [];
// };

// uniforms
uniform float isoLevel;
uniform uint totalSum;
uniform vec2 scaleVec;

const ivec4 cubeOffsets[8] = ivec4[8](
    ivec4(0, 0, 0, 0),
    ivec4(1, 0, 0, 0),
    ivec4(0, 0, 1, 0),
    ivec4(1, 0, 1, 0),
    ivec4(0, 1, 0, 0),
    ivec4(1, 1, 0, 0),
    ivec4(0, 1, 1, 0),
    ivec4(1, 1, 1, 0)    
    );

// current = ivec4 x y z sum
void scanHPLevel(uint target, int lod, inout uvec4 current)
{
    highp uint neighbors[8];

    if (lod == 0)
    {
        neighbors[0] = unpack(texelFetch(histoPyramidTexture, ivec3(current.xyz), lod).x).x;
        neighbors[1] = unpack(texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[1].xyz), lod).x).x;
        neighbors[2] = unpack(texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[2].xyz), lod).x).x;
        neighbors[3] = unpack(texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[3].xyz), lod).x).x;

        neighbors[4] = unpack(texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[4].xyz), lod).x).x;
        neighbors[5] = unpack(texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[5].xyz), lod).x).x;
        neighbors[6] = unpack(texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[6].xyz), lod).x).x;
        neighbors[7] = unpack(texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[7].xyz), lod).x).x;
    }
    else if (lod > 0 && lod < 9 )
    {
        neighbors[0] = texelFetch(histoPyramidTexture, ivec3(current.xyz), lod).x;
        neighbors[1] = texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[1].xyz), lod).x;
        neighbors[2] = texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[2].xyz), lod).x;
        neighbors[3] = texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[3].xyz), lod).x;

        neighbors[4] = texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[4].xyz), lod).x;
        neighbors[5] = texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[5].xyz), lod).x;
        neighbors[6] = texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[6].xyz), lod).x;
        neighbors[7] = texelFetch(histoPyramidTexture, ivec3(current.xyz) + ivec3(cubeOffsets[7].xyz), lod).x;
    }
    

    uint acc = uint(current.w) + neighbors[0];

        highp uint cmp[8];

        cmp[0] = acc <= target ? 1u : 0u;
        acc += neighbors[1];
        cmp[1] = acc <= target ? 1u : 0u;
        acc += neighbors[2];
        cmp[2] = acc <= target ? 1u : 0u;
        acc += neighbors[3];
        cmp[3] = acc <= target ? 1u : 0u;
        acc += neighbors[4];
        cmp[4] = acc <= target ? 1u : 0u;
        acc += neighbors[5];
        cmp[5] = acc <= target ? 1u : 0u;
        acc += neighbors[6];
        cmp[6] = acc <= target ? 1u : 0u;
        cmp[7] = 0u;

        current += uvec4(cubeOffsets[(cmp[0] + cmp[1] + cmp[2] + cmp[3] + cmp[4] + cmp[5] + cmp[6] + cmp[7])]);
        current[0] = current[0] * 2u;
        current[1] = current[1] * 2u;
        current[2] = current[2] * 2u;
        current[3] = current[3] +
            cmp[0] * neighbors[0] +
            cmp[1] * neighbors[1] +
            cmp[2] * neighbors[2] +
            cmp[3] * neighbors[3] +
            cmp[4] * neighbors[4] +
            cmp[5] * neighbors[5] +
            cmp[6] * neighbors[6] +
            cmp[7] * neighbors[7];
}

void main()
{
    ivec3 texSize = textureSize(histoPyramidTexture, 0);
    uint target = uint(gl_GlobalInvocationID.x);

    if (target >= totalSum)
    {
        target = 0u;
    }

    uvec4 cubePosition = uvec4(0); // x y z sum

    if (texSize.x > 256)
    {
        scanHPLevel(target, 8, cubePosition);
    }
    if (texSize.x > 128)
    {
        scanHPLevel(target, 7, cubePosition);
    }
    if (texSize.x > 64)
    {
        scanHPLevel(target, 6, cubePosition);
    }

    scanHPLevel(target, 5, cubePosition);
    scanHPLevel(target, 4, cubePosition);
    scanHPLevel(target, 3, cubePosition);
    scanHPLevel(target, 2, cubePosition);
    scanHPLevel(target, 1, cubePosition);
    scanHPLevel(target, 0, cubePosition);

    cubePosition.x /= 2u;
    cubePosition.y /= 2u;
    cubePosition.z /= 2u;

    highp uint vertexNr = 0u;

    //uvec4 cubeData = texelFetch(histoPyramidTexture, ivec3(cubePosition.xyz), 0);
    //uint cubeIndex = uint(imageLoad(histoPyramidBaseLevel, ivec3(cubePosition.xyz)).y);
    uint cubeIndex = unpack(texelFetch(histoPyramidTexture, ivec3(cubePosition.xyz), 0).x).y;

    // max 5 triangles 
    for (int i = int(target - cubePosition.w) * 3; i < int(target - cubePosition.w + 1u) * 3; i++)
    { // for each vertex in triangle
        //int edge = int(texelFetch(triTable, ivec2(cubeIndex * 16u + uint(i), 0), 0).x);
        int edge = int(imageLoad(triTable, ivec2(cubeIndex * 16u + uint(i), 0)).x);

        //ivec3 point0 = ivec3(cubePosition.x + texelFetch(offsets3, ivec2(edge * 6, 0), 0).x, cubePosition.y + texelFetch(offsets3, ivec2(edge * 6 + 1, 0), 0).x, cubePosition.z + texelFetch(offsets3, ivec2(edge * 6 + 2, 0), 0).x);
        //ivec3 point1 = ivec3(cubePosition.x + texelFetch(offsets3, ivec2(edge * 6 + 3, 0), 0).x, cubePosition.y + texelFetch(offsets3, ivec2(edge * 6 + 4, 0), 0).x, cubePosition.z + texelFetch(offsets3, ivec2(edge * 6 + 5, 0), 0).x);
        ivec3 point0 = ivec3(cubePosition.x + imageLoad(offsets3, ivec2(edge * 6, 0)).x, cubePosition.y + imageLoad(offsets3, ivec2(edge * 6 + 1, 0)).x, cubePosition.z + imageLoad(offsets3, ivec2(edge * 6 + 2, 0)).x);
        ivec3 point1 = ivec3(cubePosition.x + imageLoad(offsets3, ivec2(edge * 6 + 3, 0)).x, cubePosition.y + imageLoad(offsets3, ivec2(edge * 6 + 4, 0)).x, cubePosition.z + imageLoad(offsets3, ivec2(edge * 6 + 5, 0)).x);

        vec3 forwardDifference0 = vec3(
                (-texelFetch(volumeFloatTexture, ivec3(point0.x + 1, point0.y, point0.z), 0).x + texelFetch(volumeFloatTexture, ivec3(point0.x - 1, point0.y, point0.z), 0).x),
                (-texelFetch(volumeFloatTexture, ivec3(point0.x, point0.y + 1, point0.z), 0).x + texelFetch(volumeFloatTexture, ivec3(point0.x, point0.y - 1, point0.z), 0).x),
                (-texelFetch(volumeFloatTexture, ivec3(point0.x, point0.y, point0.z + 1), 0).x + texelFetch(volumeFloatTexture, ivec3(point0.x, point0.y, point0.z - 1), 0).x)
            );

        vec3 forwardDifference1 = vec3(
                (-texelFetch(volumeFloatTexture, ivec3(point1.x + 1, point1.y, point1.z), 0).x + texelFetch(volumeFloatTexture, ivec3(point1.x - 1, point1.y, point1.z), 0).x),
                (-texelFetch(volumeFloatTexture, ivec3(point1.x, point1.y + 1, point1.z), 0).x + texelFetch(volumeFloatTexture, ivec3(point1.x, point1.y - 1, point1.z), 0).x),
                (-texelFetch(volumeFloatTexture, ivec3(point1.x, point1.y, point1.z + 1), 0).x + texelFetch(volumeFloatTexture, ivec3(point1.x, point1.y, point1.z - 1), 0).x)
            );

        float value0 = texelFetch(volumeFloatTexture, ivec3(point0.x, point0.y, point0.z), 0).x;

        float testVal1 = texelFetch(volumeFloatTexture, ivec3(point1.x, point1.y, point1.z), 0).x;
        
        float diff;

        diff = (isoLevel - value0) / (testVal1 - value0);
 
        vec3 vertex = mix(vec3(point0.x, point0.y, point0.z), vec3(point1.x, point1.y, point1.z), diff); // * scaing of voxels
        vec3 normal = normalize(mix(forwardDifference0, forwardDifference1, diff));
        

        //vertex = 1023.0f * smoothstep(0.0f, 512.0f, vertex); // 1023 since we are packing using 10 bits (1024 levels)
        
        //vertex = vertex * pixDims;
        vertex = (vertex / vec3(texSize.x)) * vec3(1023.0f);

        // we would like to scale this so that you are not losing precision when we zoom in.
        // we need to cull verts that are outside of the viewing frustrum, therefore we need to find the viewing frustrum on the CPU then send its coords/plane eq as a uniform to the shader
        // currently we are always using a dynamic range of 0-1023 (actually its just uints 0 - 511)
        //posEncode[target * 3 + vertexNr] = uint(vertex.x) << 20 | uint(vertex.y) << 10 | uint(vertex.z);
        //if (vertex.x < 1022.0f && vertex.y < 1022.0f && vertex.z < 1022.0f && vertex.x > 1.0f && vertex.y > 1.0f && vertex.z > 1.0f)
        //{
         //   posEncode[target * 3u + vertexNr] = vec4(vertex.xyz, 1.0f);//uint(vertex.x) << 20u | uint(vertex.y) << 10u | uint(vertex.z);
        //    norm[target * 3u + vertexNr] = vec4(normal, 0.0f);
        posEncode[target * 3u + vertexNr] = pack(vertex);
        //}
        //else
        //{
        //    for (uint vertN = 0u; vertN < 3u; vertN++)
        //    {
        //        posEncode[target * 3u + vertN] = vec4(0.0f);
        //        norm[target * 3u + vertN] = vec4(0.0f);
        //    }
        //    break;
//
        //}


        // output normals here if we want to calc it here rather than in vertshader stage
        // norm[target * 3 + vertexNr * 3] = target;
        // norm[target * 3 + vertexNr * 3 + 1] = cubeIndex;
        // norm[target * 3 + vertexNr * 3 + 2] = vertexNr;

        ++vertexNr;
    }


}

`;