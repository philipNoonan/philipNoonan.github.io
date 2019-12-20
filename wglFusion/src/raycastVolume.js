  const raycastSource = `#version 310 es
  layout (local_size_x = 32, local_size_y = 32, local_size_z = 1) in;

  layout (r32f, binding = 0) uniform readonly highp image3D volumeData;
  layout (rgba32f, binding = 1) uniform writeonly highp image2D refVertex;
  layout (rgba32f, binding = 2) uniform writeonly highp image2D refNormal;

  uniform mat4 view;

  uniform float nearPlane;
  uniform float farPlane;
  uniform float step;
  uniform float largeStep;
  uniform float volDim;
  uniform float volSize;

  // vec2 convertIntToVec2(uint inData)
  // {
  //   vec2 outData;
    
  //   uint tX = uint(inData & 4294901760u) >> 16u; // 1111 1111 1111 1111 0000 0000 0000 0000 
	//   uint tY = uint(inData & 65535u); // 0000 0000 0000 0000 1111 1111 1111 1111

  //   outData.x = float(tX) / 1000.0f; // scaling to allow for sensible distances without hitting max size for 16 bits
  //   outData.y = float(tY) / 10.0f; // scaling to allow for sensible weights without hitting max size for 16 bits

  //   return outData;
  // }

  // uint convertVec2ToInt(vec2 inData)
  // {
  //   inData.x = min(65535.0f, 1000.0f * inData.x);
  //   inData.y = min(65535.0f, 10.0f * inData.y);

  //   uint outData;
	//   outData = uint(inData.x) << 16u | uint(inData.y);
  //   return outData;
  // }

  float vs(uvec3 pos)
  {  
    //return convertIntToVec2(imageLoad(volumeData, ivec3(pos)).x).x;
    return imageLoad(volumeData, ivec3(pos)).x;
  }

  float interpVol(vec3 pos)
  {
    vec3 scaled_pos = vec3((pos.x * volSize / volDim) - 0.5f, (pos.y * volSize / volDim) - 0.5f, (pos.z * volSize / volDim) - 0.5f);
    ivec3 base = ivec3(floor(scaled_pos));
    vec3 factor = fract(scaled_pos);
    ivec3 lower = max(base, ivec3(0));
    ivec3 upper = min(base + ivec3(1), ivec3(volSize) - ivec3(1));
    return (
          ((vs(uvec3(lower.x, lower.y, lower.z)) * (1.0f - factor.x) + vs(uvec3(upper.x, lower.y, lower.z)) * (factor.x)) * (1.0f - factor.y)
         + (vs(uvec3(lower.x, upper.y, lower.z)) * (1.0f - factor.x) + vs(uvec3(upper.x, upper.y, lower.z)) * (factor.x)) * (factor.y)) * (1.0f - factor.z)
        + ((vs(uvec3(lower.x, lower.y, upper.z)) * (1.0f - factor.x) + vs(uvec3(upper.x, lower.y, upper.z)) * (factor.x)) * (1.0f - factor.y)
         + (vs(uvec3(lower.x, upper.y, upper.z)) * (1.0f - factor.x) + vs(uvec3(upper.x, upper.y, upper.z)) * (factor.x)) * (factor.y)) * (factor.z)
        );
  }

  vec4 raycast(uvec2 pos, int camera)
  {
    vec3 origin = vec3(view[3][0], view[3][1], view[3][2]);

    vec3 direction = vec3((view * vec4(pos.x, pos.y, 1.0f, 0.0f)).xyz);

      // intersect ray with a box
      // http://www.siggraph.org/education/materials/HyperGraph/raytrace/rtinter3.htm
      // compute intersection of ray with all six bbox planes
    vec3 invR = vec3(1.0f, 1.0f, 1.0f) / direction;
    vec3 tbot = -1.0f * invR * origin;
    vec3 ttop = invR * (vec3(volDim) - origin);
    // re-order intersections to find smallest and largest on each axis
    vec3 tmin = min(ttop, tbot);
    vec3 tmax = max(ttop, tbot);
    // find the largest tmin and the smallest tmax
    float largest_tmin = max(max(tmin.x, tmin.y), max(tmin.x, tmin.z));
    float smallest_tmax = min(min(tmax.x, tmax.y), min(tmax.x, tmax.z));
    // check against near and far plane
    float tnear = max(largest_tmin, nearPlane);
    float tfar = min(smallest_tmax, farPlane);

    if (tnear < tfar)
    {

      // first walk with largesteps until we found a hit
      float t = tnear;
      float stepsize = largeStep;

      bool isInterp;
      float f_t = interpVol(vec3(origin + direction * t));
      float f_tt = 0.0f;
      if (f_t >= 0.0f)
      {  // ups, if we were already in it, then don't render anything here

        for (; t < tfar; t += stepsize)
        {
          f_tt = interpVol(vec3(origin + direction * t));

          if (f_tt < 0.0f) // got it, jump out of inner loop
          {
            break; // 
          }
          if (f_tt < 0.8f)
          {
            stepsize = step;
          }
          f_t = f_tt;
        }
        if (f_tt < 0.0f) // got it, calculate accurate intersection
        {
          t = t + stepsize * f_tt / (f_t - f_tt);
          return vec4(origin + direction * t, t);
        }
      }
    }
    return vec4(0.0f, 0.0f, 0.0f, 0.0f);
  }

  vec3 getGradient(vec4 hit)
  {
    vec3 scaled_pos = vec3((hit.x * volSize / volDim) - 0.5f, (hit.y * volSize / volDim) - 0.5f, (hit.z * volSize / volDim) - 0.5f);
    ivec3 baseVal = ivec3(floor(scaled_pos));
    vec3 factor = fract(scaled_pos);
    ivec3 lower_lower = max(baseVal - ivec3(1), ivec3(0));
    ivec3 lower_upper = max(baseVal, ivec3(0));
    ivec3 upper_lower = min(baseVal + ivec3(1), ivec3(volSize) - ivec3(1));
    ivec3 upper_upper = min(baseVal + ivec3(2), ivec3(volSize) - ivec3(1));
    ivec3 lower = lower_upper;
    ivec3 upper = upper_lower;

    vec3 gradient;

    gradient.x =
              (((vs(uvec3(upper_lower.x, lower.y, lower.z)) - vs(uvec3(lower_lower.x, lower.y, lower.z))) * (1.0f - factor.x)
            + (vs(uvec3(upper_upper.x, lower.y, lower.z)) - vs(uvec3(lower_upper.x, lower.y, lower.z))) * factor.x) * (1.0f - factor.y)
            + ((vs(uvec3(upper_lower.x, upper.y, lower.z)) - vs(uvec3(lower_lower.x, upper.y, lower.z))) * (1.0f - factor.x)
            + (vs(uvec3(upper_upper.x, upper.y, lower.z)) - vs(uvec3(lower_upper.x, upper.y, lower.z))) * factor.x) * factor.y) * (1.0f - factor.z)
            + (((vs(uvec3(upper_lower.x, lower.y, upper.z)) - vs(uvec3(lower_lower.x, lower.y, upper.z))) * (1.0f - factor.x)
            + (vs(uvec3(upper_upper.x, lower.y, upper.z)) - vs(uvec3(lower_upper.x, lower.y, upper.z))) * factor.x) * (1.0f - factor.y)
            + ((vs(uvec3(upper_lower.x, upper.y, upper.z)) - vs(uvec3(lower_lower.x, upper.y, upper.z))) * (1.0f - factor.x)
            + (vs(uvec3(upper_upper.x, upper.y, upper.z)) - vs(uvec3(lower_upper.x, upper.y, upper.z))) * factor.x) * factor.y) * factor.z;

    gradient.y =
          (((vs(uvec3(lower.x, upper_lower.y, lower.z)) - vs(uvec3(lower.x, lower_lower.y, lower.z))) * (1.0f - factor.x)
        + (vs(uvec3(upper.x, upper_lower.y, lower.z)) - vs(uvec3(upper.x, lower_lower.y, lower.z))) * factor.x) * (1.0f - factor.y)
        + ((vs(uvec3(lower.x, upper_upper.y, lower.z)) - vs(uvec3(lower.x, lower_upper.y, lower.z))) * (1.0f - factor.x)
        + (vs(uvec3(upper.x, upper_upper.y, lower.z)) - vs(uvec3(upper.x, lower_upper.y, lower.z))) * factor.x) * factor.y) * (1.0f - factor.z)
        + (((vs(uvec3(lower.x, upper_lower.y, upper.z)) - vs(uvec3(lower.x, lower_lower.y, upper.z))) * (1.0f - factor.x)
        + (vs(uvec3(upper.x, upper_lower.y, upper.z)) - vs(uvec3(upper.x, lower_lower.y, upper.z))) * factor.x) * (1.0f - factor.y)
        + ((vs(uvec3(lower.x, upper_upper.y, upper.z)) - vs(uvec3(lower.x, lower_upper.y, upper.z))) * (1.0f - factor.x)
        + (vs(uvec3(upper.x, upper_upper.y, upper.z)) - vs(uvec3(upper.x, lower_upper.y, upper.z))) * factor.x) * factor.y) * factor.z;

    gradient.z =
          (((vs(uvec3(lower.x, lower.y, upper_lower.z)) - vs(uvec3(lower.x, lower.y, lower_lower.z))) * (1.0f - factor.x)
        + (vs(uvec3(upper.x, lower.y, upper_lower.z)) - vs(uvec3(upper.x, lower.y, lower_lower.z))) * factor.x) * (1.0f - factor.y)
        + ((vs(uvec3(lower.x, upper.y, upper_lower.z)) - vs(uvec3(lower.x, upper.y, lower_lower.z))) * (1.0f - factor.x)
        + (vs(uvec3(upper.x, upper.y, upper_lower.z)) - vs(uvec3(upper.x, upper.y, lower_lower.z))) * factor.x) * factor.y) * (1.0f - factor.z)
        + (((vs(uvec3(lower.x, lower.y, upper_upper.z)) - vs(uvec3(lower.x, lower.y, lower_upper.z))) * (1.0f - factor.x)
        + (vs(uvec3(upper.x, lower.y, upper_upper.z)) - vs(uvec3(upper.x, lower.y, lower_upper.z))) * factor.x) * (1.0f - factor.y)
        + ((vs(uvec3(lower.x, upper.y, upper_upper.z)) - vs(uvec3(lower.x, upper.y, lower_upper.z))) * (1.0f - factor.x)
        + (vs(uvec3(upper.x, upper.y, upper_upper.z)) - vs(uvec3(upper.x, upper.y, lower_upper.z))) * factor.x) * factor.y) * factor.z;

    return gradient * vec3(volDim / volSize, volDim / volSize, volDim / volSize) * (0.5f);
  }

  void main()
  {
    int numberOfCameras = 1;
    uvec2 pix = gl_GlobalInvocationID.xy;
    for (int camera = 0; camera < numberOfCameras; camera++)
    {
      // for (int z = 0; z < 128; z++)
      // {
      //   float deets = imageLoad(volumeData, ivec3(pix.xy, z)).x;
      //   if (deets != 0.0f)
      //   {
      //     imageStore(refNormal, ivec2(pix), vec4(0.5,0.5,0.5, 1.0f));
      //   }
      // }

      vec4 hit = raycast(pix, camera);
      if (hit.w > 0.0f)
      {
        imageStore(refVertex, ivec2(pix), vec4(hit.xyz, 1.0f));

        vec3 surfNorm = getGradient(hit);
        if (length(surfNorm) == 0.0f)
        {
          imageStore(refNormal, ivec2(pix), vec4(0.0f));
        }
        else
        {
          imageStore(refNormal, ivec2(pix), vec4(normalize(surfNorm), 1.0f));
        }
      }
      else
      {
        imageStore(refVertex, ivec2(pix), vec4(0.0f));
        imageStore(refNormal, ivec2(pix), vec4(0.0f));
      }
      
    }
  }
  `;