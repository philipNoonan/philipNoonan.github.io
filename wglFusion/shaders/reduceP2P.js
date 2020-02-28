  const p2pReduceSource = `#version 310 es
  layout (local_size_x = 112, local_size_y = 1, local_size_z = 1) in;
  precision highp float;
  
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

  layout(std430, binding = 1) buffer OutputData
  {
    float data[];
  } outputData;

  uniform vec2 imSize; 
  shared float S[112][32];

  void main()
  {
    uint sline = gl_LocalInvocationID.x; // 0 - 111

    float sums[32];
    for (int i = 0; i < 32; ++i) 
    { 
        sums[i] = 0.0f;
    }

    for (uint y = gl_WorkGroupID.x; y < uint(imSize.y); y += gl_NumWorkGroups.x)
    {
      for (uint x = sline; x < uint(imSize.x); x += gl_WorkGroupSize.x)
      {
        //reduType row = trackOutput.data[(y * uint(imSize.x)) + x];

        if (trackOutput.data[(y * uint(imSize.x)) + x].result < 1.0f)
        {
          if (trackOutput.data[(y * uint(imSize.x)) + x].result == -4.0f)
          {
            sums[29]++;
          }
          if (trackOutput.data[(y * uint(imSize.x)) + x].result == -5.0f)
          {
            sums[30]++;
          }
          if (trackOutput.data[(y * uint(imSize.x)) + x].result > -4.0f)
          {
            sums[31]++;
          }
          continue;
        }

        // Error part
        sums[0] += trackOutput.data[(y * uint(imSize.x)) + x].error * trackOutput.data[(y * uint(imSize.x)) + x].error;

        // JTe part
        for (int i = 0; i < 6; ++i)
        {
          sums[i + 1] += trackOutput.data[(y * uint(imSize.x)) + x].error * trackOutput.data[(y * uint(imSize.x)) + x].J[i];
        }

        // JTJ part
        sums[7] += trackOutput.data[(y * uint(imSize.x)) + x].J[0] * trackOutput.data[(y * uint(imSize.x)) + x].J[0];
        sums[8] += trackOutput.data[(y * uint(imSize.x)) + x].J[0] * trackOutput.data[(y * uint(imSize.x)) + x].J[1];
        sums[9] += trackOutput.data[(y * uint(imSize.x)) + x].J[0] * trackOutput.data[(y * uint(imSize.x)) + x].J[2];
        sums[10] += trackOutput.data[(y * uint(imSize.x)) + x].J[0] * trackOutput.data[(y * uint(imSize.x)) + x].J[3];
        sums[11] += trackOutput.data[(y * uint(imSize.x)) + x].J[0] * trackOutput.data[(y * uint(imSize.x)) + x].J[4];
        sums[12] += trackOutput.data[(y * uint(imSize.x)) + x].J[0] * trackOutput.data[(y * uint(imSize.x)) + x].J[5];

        sums[13] += trackOutput.data[(y * uint(imSize.x)) + x].J[1] * trackOutput.data[(y * uint(imSize.x)) + x].J[1];
        sums[14] += trackOutput.data[(y * uint(imSize.x)) + x].J[1] * trackOutput.data[(y * uint(imSize.x)) + x].J[2];
        sums[15] += trackOutput.data[(y * uint(imSize.x)) + x].J[1] * trackOutput.data[(y * uint(imSize.x)) + x].J[3];
        sums[16] += trackOutput.data[(y * uint(imSize.x)) + x].J[1] * trackOutput.data[(y * uint(imSize.x)) + x].J[4];
        sums[17] += trackOutput.data[(y * uint(imSize.x)) + x].J[1] * trackOutput.data[(y * uint(imSize.x)) + x].J[5];

        sums[18] += trackOutput.data[(y * uint(imSize.x)) + x].J[2] * trackOutput.data[(y * uint(imSize.x)) + x].J[2];
        sums[19] += trackOutput.data[(y * uint(imSize.x)) + x].J[2] * trackOutput.data[(y * uint(imSize.x)) + x].J[3];
        sums[20] += trackOutput.data[(y * uint(imSize.x)) + x].J[2] * trackOutput.data[(y * uint(imSize.x)) + x].J[4];
        sums[21] += trackOutput.data[(y * uint(imSize.x)) + x].J[2] * trackOutput.data[(y * uint(imSize.x)) + x].J[5];

        sums[22] += trackOutput.data[(y * uint(imSize.x)) + x].J[3] * trackOutput.data[(y * uint(imSize.x)) + x].J[3];
        sums[23] += trackOutput.data[(y * uint(imSize.x)) + x].J[3] * trackOutput.data[(y * uint(imSize.x)) + x].J[4];
        sums[24] += trackOutput.data[(y * uint(imSize.x)) + x].J[3] * trackOutput.data[(y * uint(imSize.x)) + x].J[5];

        sums[25] += trackOutput.data[(y * uint(imSize.x)) + x].J[4] * trackOutput.data[(y * uint(imSize.x)) + x].J[4];
        sums[26] += trackOutput.data[(y * uint(imSize.x)) + x].J[4] * trackOutput.data[(y * uint(imSize.x)) + x].J[5];
        
        sums[27] += trackOutput.data[(y * uint(imSize.x)) + x].J[5] * trackOutput.data[(y * uint(imSize.x)) + x].J[5];

        sums[28] += 1.0f;
      }
    }

    for (int i = 0; i < 32; ++i)
    {
      S[sline][i] = sums[i];
    }
     
    barrier(); // wait for threads to finish

    if (sline < 32u)
    {
      for(uint i = 1u; i < gl_WorkGroupSize.x; ++i)
      {
        S[0][sline] += S[i][sline];
      }

      outputData.data[sline + gl_WorkGroupID.x * 32u] = S[0][sline];
    }
  }
  `;