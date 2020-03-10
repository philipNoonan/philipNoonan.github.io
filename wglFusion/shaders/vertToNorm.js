  const vertToNormSource = `#version 310 es
  layout (local_size_x = 32, local_size_y = 32, local_size_z = 1) in;
  layout (rgba32f, binding = 0) uniform readonly highp image2D vertexImage;
  layout (rgba32f, binding = 1) uniform writeonly highp image2D normalImage;

  void main() {
    ivec2 u = ivec2(gl_GlobalInvocationID.xy);
    
    vec4 vert0 = imageLoad(vertexImage, u - ivec2(1, 0));
    vec4 vert1 = imageLoad(vertexImage, u + ivec2(1, 0));
    vec4 vert2 = imageLoad(vertexImage, u - ivec2(0, 1));
    vec4 vert3 = imageLoad(vertexImage, u + ivec2(0, 1));
    vec4 vert4 = imageLoad(vertexImage, u);

    if (vert0.w > 0.0f && vert1.w > 0.0f && vert2.w > 0.0f  && vert3.w > 0.0f && vert4.w > 0.0f)
    {
      vec3 vecX = normalize(vert1.xyz - vert0.xyz);
      vec3 vecY = normalize(vert3.xyz - vert2.xyz);

      imageStore(normalImage, u, vec4(normalize(cross(vecY, vecX)), 0.0));
    }
    else
    {
      imageStore(normalImage, u, vec4(0.0));
    }
  }
  `;