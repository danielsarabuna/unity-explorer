import * as path from 'path';

export interface CodeTemplate {
  filename: string;
  content: string;
  isFolder: boolean;
  isCSharp: boolean;
}

export class TemplateManager {
  public static deriveNamespace(workspaceRoot: string, fileDir: string): string {
    const relative = path.relative(workspaceRoot, fileDir);
    const parts = relative
      .split(path.sep)
      .filter(p => p && p !== 'Assets' && p !== 'Scripts')
      .map(p => p.replace(/[^a-zA-Z0-9_]/g, ''));
    
    if (parts.length === 0) {
      return 'Project';
    }
    return parts.join('.');
  }

  public static getMonoBehaviourTemplate(name: string, namespaceName: string): CodeTemplate {
    return {
      filename: `${name}.cs`,
      content: `using UnityEngine;

namespace ${namespaceName}
{
    public class ${name} : MonoBehaviour
    {
        private void Start()
        {
            
        }

        private void Update()
        {
            
        }
    }
}
`,
      isFolder: false,
      isCSharp: true
    };
  }

  public static getScriptableObjectTemplate(name: string, namespaceName: string): CodeTemplate {
    return {
      filename: `${name}.cs`,
      content: `using UnityEngine;

namespace ${namespaceName}
{
    [CreateAssetMenu(fileName = "${name}", menuName = "${namespaceName}/${name}", order = 0)]
    public class ${name} : ScriptableObject
    {
        
    }
}
`,
      isFolder: false,
      isCSharp: true
    };
  }

  public static getUnlitShaderTemplate(name: string): CodeTemplate {
    return {
      filename: `${name}.shader`,
      content: `Shader "Custom/${name}"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 100

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 vertex : SV_POSITION;
            };

            sampler2D _MainTex;
            float4 _MainTex_ST;

            v2f vert (appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 col = tex2D(_MainTex, i.uv);
                return col;
            }
            ENDCG
        }
    }
}
`,
      isFolder: false,
      isCSharp: false
    };
  }

  public static getAsmdefTemplate(name: string): CodeTemplate {
    return {
      filename: `${name}.asmdef`,
      content: JSON.stringify(
        {
          name: name,
          rootNamespace: name,
          references: [],
          includePlatforms: [],
          excludePlatforms: [],
          allowUnsafeCode: false,
          overrideReferences: false,
          precompiledReferences: [],
          autoReferenced: true,
          defineConstraints: [],
          versionDefines: [],
          noEngineReferences: false
        },
        null,
        4
      ),
      isFolder: false,
      isCSharp: false
    };
  }

  public static getMaterialTemplate(name: string): CodeTemplate {
    return {
      filename: `${name}.mat`,
      content: `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!21 &2100000
Material:
  serializedVersion: 8
  m_Name: ${name}
  m_Shader: {fileID: 4800000, guid: 0000000000000000f000000000000000, type: 0}
  m_ValidKeywords: []
  m_InvalidKeywords: []
`,
      isFolder: false,
      isCSharp: false
    };
  }
}
