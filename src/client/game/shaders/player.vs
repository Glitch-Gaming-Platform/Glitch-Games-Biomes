#version 300 es

// Constants.
const vec3[6] normals = vec3[](vec3(-1, 0, 0), vec3(1, 0, 0), vec3(0, -1, 0), vec3(0, 1, 0), vec3(0, 0, -1), vec3(0, 0, 1));

// Uniforms.
uniform mat3 normalMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 light;

#if defined(USE_SKINNING)
uniform mat4 bindMatrix;
uniform mat4 bindMatrixInverse;
uniform highp sampler2D boneTexture;
#endif

// Vertex attributes.
in float direction;
in vec2 texCoord;
in vec3 normal;
in vec3 position;
in vec4 color;
#if defined(USE_SKINNING)
in vec4 skinIndex;
in vec4 skinWeight;
#endif

// Varying output to the fragment shader. All of the spatial outputs
// are represented in view coordinates and relative to the vertex.
out vec2 _texCoord;
out vec3 _up;
out vec3 _eye;
out vec3 _light;
out vec3 _normal;
out vec4 _color;
flat out uint _direction;

#if defined(USE_SKINNING)
mat4 getBoneMatrix(const in float i) {
  // Three.js r185 no longer uploads its legacy boneTextureSize uniform.
  // Querying the texture directly keeps custom RawShaderMaterial skinning in
  // lockstep with Three's current WebGL skinning chunk and avoids NaN vertex
  // positions when the removed uniform defaults to zero.
  int size = textureSize(boneTexture, 0).x;
  int j = int(i) * 4;
  int x = j % size;
  int y = j / size;
  vec4 v1 = texelFetch(boneTexture, ivec2(x, y), 0);
  vec4 v2 = texelFetch(boneTexture, ivec2(x + 1, y), 0);
  vec4 v3 = texelFetch(boneTexture, ivec2(x + 2, y), 0);
  vec4 v4 = texelFetch(boneTexture, ivec2(x + 3, y), 0);
  mat4 bone = mat4(v1, v2, v3, v4);
  return bone;
}

void getSkinnedPosition(const in vec3 position, const in vec3 normal, out vec3 skinnedPosition, out vec3 skinnedNormal) {
  // Apply skinning calculations. This code is using
  //   https://github.com/mrdoob/three.js/blob/f74105c7276cf734498c87063ed46d19e5aa952f/src/renderers/shaders/ShaderLib/meshbasic.glsl.js#L20-L28
  // as a reference. However, we assume that the first skinIndex has 100% of
  // the weight and so we don't do any blending of bones here.
  mat4 boneMatX = getBoneMatrix(skinIndex.x);

  vec4 skinVertex = bindMatrix * vec4(position, 1.0);
  vec4 skinned = boneMatX * skinVertex * skinWeight.x;
  skinnedPosition = (bindMatrixInverse * skinned).xyz;

  mat4 skinMatrix = skinWeight.x * boneMatX;
  skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
  skinnedNormal = vec4(skinMatrix * vec4(normal, 0.0)).xyz;
}

float skinIndexZOffset() {
  return 0.0001 * skinIndex.x;
}

#else

void getSkinnedPosition(const in vec3 position, const in vec3 normal, out vec3 skinnedPosition, out vec3 skinnedNormal) {
  skinnedPosition = position;
  skinnedNormal = normal;
}

float skinIndexZOffset() {
  return 0.0;
}

#endif

void main() {
  vec3 skinnedPosition;
  vec3 skinnedNormal;

  getSkinnedPosition(position, normal, skinnedPosition, skinnedNormal);
  vec4 viewPosition = modelViewMatrix * vec4(skinnedPosition, 1.0);

  // Set the vertex position on the screen.
  gl_Position = projectionMatrix * viewPosition;

  // The joint index doubles as a polygon offset ordering, so smaller indices
  // will appear "in front" of larger indices.
  gl_Position.z += skinIndexZOffset();

  // Forward view-independent vertex attributes.
  _direction = uint(direction);
  _texCoord = texCoord;

  // Emit the view-dependent vertex attributes.
  _normal = normalize(normalMatrix * skinnedNormal);
  _light = normalize(normalMatrix * light);
  _up = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
  _eye = -normalize(viewPosition.xyz);
  _color = color;
}
