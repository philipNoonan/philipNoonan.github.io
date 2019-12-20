  const p2pTrackSource = `#version 310 es
  layout (local_size_x = 32, local_size_y = 32, local_size_z = 1) in;
  layout(binding = 0, rgba32f) readonly uniform highp image2D inVertex;
  layout(binding = 1, rgba32f) readonly uniform highp image2D inNormal;

  layout(binding = 2, rgba32f) readonly uniform highp image2D refVertex;
  layout(binding = 3, rgba32f) readonly uniform highp image2D refNormal;

  layout(binding = 4, rgba8ui) writeonly uniform highp uimage2D trackImage;

  uniform mat4 T;
  uniform float distThresh;
  uniform float normThresh;
  uniform int mip;
  uniform vec4 cam; // cx cy fx fy

  vec3 projectPointImage(vec3 p)
  {
      return vec3(((cam.z * p.x) / p.z) + cam.x,
                  ((cam.w * p.y) / p.z) + cam.y,
                  p.z);
  }

  struct reduType
  {
    float result;
    float error;
    float J[6];
  };

  layout(std430, binding = 0) buffer TrackData
  {
    reduType data[];
  } trackOutput;


  void main()
  {
    int numberOfCameras = 1;
    ivec2 pix = ivec2(gl_GlobalInvocationID.xy);
    ivec2 imSize = imageSize(inVertex); // mipmapped sizes
    ivec2 refSize = imageSize(refVertex); // full depth size

    uint offset = uint((pix.y * imSize.x) + pix.x);

    for (int camera = 0; camera < numberOfCameras; camera++)
    {
      uint offset = uint(camera * imSize.x * imSize.y) + uint((pix.y * imSize.x) + pix.x);
      if (pix.x < imSize.x && pix.y < imSize.y)
      {
        vec4 normals = imageLoad(inNormal, ivec2(pix));
        if (normals.x == 2.0f)
        {
          trackOutput.data[offset].result = -1.0f; // does this matter since we are in a low mipmap not full size???
          imageStore(trackImage, ivec2(pix), uvec4(0, 0, 0, 0));
        }
        else
        {
          // depth vert in global space
          vec4 projectedVertex = T * vec4(imageLoad(inVertex, ivec2(pix)).xyz, 1.0f);
          // this depth vert in global space is then prejected back to normal depth space
		  vec3 projPixel = projectPointImage(projectedVertex.xyz);
          if (projPixel.x < 0.0f || int(projPixel.x) > refSize.x || projPixel.y < 0.0f || int(projPixel.y) > refSize.y)
          {
            trackOutput.data[offset].result = -2.0f;
            imageStore(trackImage, ivec2(pix), uvec4(255, 0, 0, 255));
          }
          else
          {
			// THIS IS NOT THE FIX!!!! THIS JUST DOES LOTS OF ITERATIONS WITHOUT TRYING TO UPDATE T, maybe, not his is probably ok, T is getting updated so projectedVertex is changing each iter
            ivec2 refPixel = ivec2(pix.x << mip, pix.y << mip);//ivec2(projPixel.x + 0.5f, projPixel.y + 0.5f);
            vec3 referenceNormal = imageLoad(refNormal, refPixel).xyz;
            vec3 tmp = imageLoad(refVertex, refPixel).xyz;

            if (referenceNormal.x == -2.0f)
            {
              trackOutput.data[offset].result = -3.0f;
              imageStore(trackImage, ivec2(pix), uvec4(0, 255, 0, 255));
            }
            else
            {
			  vec3 refVert = imageLoad(refVertex, refPixel).xyz;
              vec3 diff = refVert - projectedVertex.xyz;
              vec4 currNormal = imageLoad(inNormal, ivec2(pix));
              vec3 projectedNormal = vec3((T * vec4(currNormal.xyz, 0.0f)).xyz); // input mipmap sized pixel

              if (length(diff) > distThresh)
              {
                trackOutput.data[offset].result = -4.0f;
                imageStore(trackImage, ivec2(pix), uvec4(0, 0, 255, 255));
              }
              else if (dot(projectedNormal, referenceNormal) < normThresh)
              {
                trackOutput.data[offset].result = -5.0f;
                imageStore(trackImage, ivec2(pix), uvec4(255, 255, 0, 255));
              }
              else
              {
                imageStore(trackImage, ivec2(pix), uvec4(127, 127, 127, 255));

                trackOutput.data[offset].result = 1.0f;
                trackOutput.data[offset].error = dot(referenceNormal, diff);

                trackOutput.data[offset].J[0] = referenceNormal.x;
                trackOutput.data[offset].J[1] = referenceNormal.y;
                trackOutput.data[offset].J[2] = referenceNormal.z;

                vec3 crossProjVertRefNorm = cross(projectedVertex.xyz, referenceNormal);
                trackOutput.data[offset].J[3] = crossProjVertRefNorm.x;
                trackOutput.data[offset].J[4] = crossProjVertRefNorm.y;
                trackOutput.data[offset].J[5] = crossProjVertRefNorm.z;
              }
            }
          }
        }
      }
    }
  }
  `;