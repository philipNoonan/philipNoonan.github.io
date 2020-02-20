const integrateSource = `#version 310 es
  layout (local_size_x = 32, local_size_y = 32, local_size_z = 1) in;
  layout (r32f, binding = 0) uniform highp image3D volumeData;
  layout (r32f, binding = 1) uniform highp image3D volumeWeightData;

  layout (rgba32f, binding = 2) uniform readonly highp image2D vertexImage;
  layout (rgba8ui, binding = 3) uniform readonly highp uimage2D trackImage;
  layout (rgba32f, binding = 4) uniform writeonly highp image2D normalImage;

  uniform int integrateFlag;
  uniform int resetFlag;

  uniform mat4 invT;
  uniform vec4 cam; // cx cy fx fy

  uniform int p2p;
  uniform int p2v;

  uniform float maxWeight;

  uniform float volDim; // length in meters FLOAT!!!!
  uniform float volSize; // voxel grid size

  // // to store in es3.1 compatible read/write image formats, we need to pack the floats into a single r32i image
  // // 
  // vec2 convertIntToVec2(int inData)
  // {
  //   vec2 outData;
    
  //   int tX = uint(inData & 4294901760) >> 16; // 1111 1111 1111 1111 0000 0000 0000 0000 
	//   int tY = uint(inData & 65535); // 0000 0000 0000 0000 1111 1111 1111 1111

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


  vec3 projectPointImage(vec3 p)
  {
      return vec3(((cam.z * p.x) / p.z) + cam.x,
                  ((cam.w * p.y) / p.z) + cam.y,
                  p.z);
  }

  vec3 getVolumePosition(uvec3 p)
  {
      return vec3((float(p.x) + 0.5f) * volDim / volSize, (float(p.y) + 0.5f) * volDim / volSize, (float(p.z) + 0.5f) * volDim / volSize);
  }

  vec2 getSDF(uvec3 pos)
  {
      //uint dataIn = imageLoad(volumeData, ivec3(pos)).x;
      //return convertIntToVec2(dataIn);

      return vec2(imageLoad(volumeData, ivec3(pos)).x, imageLoad(volumeWeightData, ivec3(pos)).x);
  }

  bool inFrustrum(in vec4 pClip)
  {
      return abs(pClip.x) < pClip.w &&
            abs(pClip.y) < pClip.w; 
  }

  void integrate()
  {
    int numberOfCameras = 1;

    ivec2 depthSize = ivec2(imageSize(vertexImage).xy);
    uvec3 pix = gl_GlobalInvocationID.xyz;

    float diff[4]; // max number of cameras on one system

    vec4 track[4];
    int bestTrack;

    for (pix.z = 0u; pix.z < uint(volSize); pix.z++)
    {
      for (int cameraDevice = 0; cameraDevice < numberOfCameras; cameraDevice++)
      {
      // get world position of centre of voxel 
        vec3 worldPos = vec3(invT * vec4(getVolumePosition(pix), 1.0f)).xyz;
        vec3 pixel = projectPointImage(worldPos);
        ivec2 px = ivec2(pixel.x + 0.5f, pixel.y + 0.5f); // for rounding

        //imageStore(volumeData, ivec3(pix), vec4(dMin, dMax, 0, 0));
        // if we dont check if we hit the image here and just assume that if pixel is out of bounds the resultant texture read will be zero
        if (px.x < 0 || px.x > depthSize.x - 1 || px.y < 0 || px.y > depthSize.y - 1)
        {
          diff[cameraDevice] = -10000.0f;
          continue;
        }

        track[cameraDevice] = vec4(imageLoad(trackImage, px));

        vec4 depthPoint = imageLoad(vertexImage, px);

        if (depthPoint.z <= 0.0f)
        {
          diff[cameraDevice] = -10000.0f;
          continue;
        }

        // if we get here, then the voxel is seen by this cameraDevice
        // determin best cameraDevice
        vec3 shiftVec = worldPos - depthPoint.xyz;
        float tdiff = length(shiftVec);
        diff[cameraDevice] = shiftVec.z < 0.0 ? tdiff : -tdiff;

      }

      float finalDiff = 10000.0f;
      float validCameras = 0.0f;
      for (int cameraDevice = 0; cameraDevice < numberOfCameras; cameraDevice++)
      {
        if (diff[cameraDevice] != 10000.0f)
        {
          if (abs(diff[cameraDevice]) < abs(finalDiff))
          {
            bestTrack = cameraDevice;
            finalDiff = diff[cameraDevice];
          }
        }
      }

      float ctfo = 0.1f;
      if (track[bestTrack] == vec4(0.5f, 0.5f, 0.5f, 1.0 ))
      {
          ctfo = 0.1f;
      }
      else if (track[bestTrack] == vec4(1.0f, 1.0f, 0.0f, 1.0))
      {
          ctfo = 0.001f;
      }
      else if (track[bestTrack] == vec4(1.0f, 0.0f, 0.0f, 1.0))
      {
          ctfo = 0.001f;
      }

      float dMin = -volDim / 20.0f;
      float dMax = volDim / 10.0f;
      // if diff within TSDF range, write to volume
      if (finalDiff < dMax && finalDiff > dMin)
      {
        vec2 data = getSDF(pix);
        float weightedDistance = 0.0f;
        if (p2p == 1)
        {
          weightedDistance = (data.y * data.x + finalDiff) / (data.y + 1.0f);
        }
        else if (p2v == 1)
        {
          weightedDistance = (data.y * data.x + ctfo * finalDiff) / (data.y + ctfo);
        }
        if (weightedDistance < dMax)
        {
          data.x = clamp(weightedDistance, dMin, dMax);
          data.y = min(data.y + 1.0f, (maxWeight));
        }
        else
        {
          data.x = 0.0f;
          data.y = 0.0f;
        }
        //uint dataOut = convertVec2ToInt(data);  
        imageStore(volumeData, ivec3(pix), vec4(data.x, 0, 0, 0));
        imageStore(volumeWeightData, ivec3(pix), vec4(data.y));
      }
      else
      {
        // pix.z += 50; // need to be clever here, but this could work nicely woudl like to jump to just before the 
        // imageStore(volumeData, ivec3(pix), uvec4(0));
      }     
    }
  }

  void resetVolume()
  {
    uvec2 pix = gl_GlobalInvocationID.xy;
    if (pix.x < uint(volSize) && pix.y < uint(volSize))
    {
      for (int zDep = 0; zDep < int(volSize); zDep++)
      {
        imageStore(volumeData, ivec3(pix.x, pix.y, zDep), vec4(0));
        imageStore(volumeWeightData, ivec3(pix.x, pix.y, zDep), vec4(0));
      }
    }
  }

  void main()
  {
    if (integrateFlag == 1)
    {
      integrate();
    }
    else if (resetFlag == 1)
    {
      resetVolume();
    }
  }
  `;