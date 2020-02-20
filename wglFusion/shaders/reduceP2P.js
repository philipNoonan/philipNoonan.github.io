  const p2pReduceSource = `#version 310 es
  layout (local_size_x = 112, local_size_y = 1, local_size_z = 1) in;

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
        reduType row = trackOutput.data[(y * uint(imSize.x)) + x];
        if (row.result < 1.0f)
        {
          if (row.result == -4.0f)
          {
            sums[29]++;
          }
          if (row.result == -5.0f)
          {
            sums[30]++;
          }
          if (row.result > -4.0f)
          {
            sums[31]++;
          }
          continue;
        }

        // Error part
        sums[0] += row.error * row.error;

        // JTe part
        for (int i = 0; i < 6; ++i)
        {
          sums[i + 1] += row.error * row.J[i];
        }

        // JTJ part
        sums[7] += row.J[0] * row.J[0];
        sums[8] += row.J[0] * row.J[1];
        sums[9] += row.J[0] * row.J[2];
        sums[10] += row.J[0] * row.J[3];
        sums[11] += row.J[0] * row.J[4];
        sums[12] += row.J[0] * row.J[5];

        sums[13] += row.J[1] * row.J[1];
        sums[14] += row.J[1] * row.J[2];
        sums[15] += row.J[1] * row.J[3];
        sums[16] += row.J[1] * row.J[4];
        sums[17] += row.J[1] * row.J[5];

        sums[18] += row.J[2] * row.J[2];
        sums[19] += row.J[2] * row.J[3];
        sums[20] += row.J[2] * row.J[4];
        sums[21] += row.J[2] * row.J[5];

        sums[22] += row.J[3] * row.J[3];
        sums[23] += row.J[3] * row.J[4];
        sums[24] += row.J[3] * row.J[5];

        sums[25] += row.J[4] * row.J[4];
        sums[26] += row.J[4] * row.J[5];

        sums[27] += row.J[5] * row.J[5];

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