  const depthToVertSource = `#version 310 es
  layout (local_size_x = 32, local_size_y = 32, local_size_z = 1) in;
  layout (r32f, binding = 0) uniform readonly highp image2D depthImage;
  layout (rgba32f, binding = 1) uniform writeonly highp image2D vertexImage;

  uniform mat4 invK;
  uniform float minDepth;
  uniform float maxDepth;

  uniform vec2 bottomLeft;
  uniform vec2 topRight;

  void main() {
    ivec2 u = ivec2(gl_GlobalInvocationID.xy);

    float z = imageLoad(depthImage, u).x * (6.55350f); // this has been manually set and depends on the depth scale set by the realsense sdk, its the short->float scaled by depth scale, seems to work

    if (z >= minDepth && z <= maxDepth
        && u.x > int(bottomLeft.x) && u.y > int(bottomLeft.y)
        && u.x < int(topRight.x) && u.y < int(topRight.y))
        {
          vec3 v = z * mat3(invK) * vec3(u, 1.0f);
          imageStore(vertexImage, u, vec4(v, 1.0f));
        }
        else
        {
          imageStore(vertexImage, u, vec4(0.0f));
        }
  }
  `;