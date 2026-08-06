import { describe, it, expect } from 'vitest';
import { CSharpSymbolIndexer } from '../../src/search/CSharpSymbolIndexer';
import { ScopeResolver } from '../../src/search/ScopeResolver';
import { SymbolKind, AccessModifier, UnityAttribute } from '../../src/search/SymbolTypes';

describe('CSharpSymbolIndexer Parsing', () => {
  const dummyResolver = new ScopeResolver('/dummy');
  const indexer = new CSharpSymbolIndexer('/dummy', dummyResolver);

  it('parses classes, structs, interfaces, enums, records, delegates', () => {
    const code = `
      namespace Game.Core
      {
        public class PlayerController : MonoBehaviour, IDamageable
        {
        }

        public struct HealthData
        {
        }

        public interface IDamageable
        {
        }

        public enum GameState
        {
          Menu = 0,
          Playing = 1
        }

        public record PlayerRecord(int Id, string Name);

        public delegate void DamageHandler(int amount);
      }
    `;

    const symbols = indexer.parseCSharpCode(code, '/dummy/Player.cs', 'Assembly-CSharp');

    const kinds = symbols.map(s => s.kind);
    expect(kinds).toContain(SymbolKind.Class);
    expect(kinds).toContain(SymbolKind.Struct);
    expect(kinds).toContain(SymbolKind.Interface);
    expect(kinds).toContain(SymbolKind.Enum);
    expect(kinds).toContain(SymbolKind.EnumMember);
    expect(kinds).toContain(SymbolKind.Record);
    expect(kinds).toContain(SymbolKind.Delegate);

    const playerClass = symbols.find(s => s.name === 'PlayerController');
    expect(playerClass).toBeDefined();
    expect(playerClass?.access).toBe(AccessModifier.Public);
    expect(playerClass?.namespaceName).toBe('Game.Core');
    expect(playerClass?.baseTypes).toContain('MonoBehaviour');
  });

  it('parses fields, properties, constants, methods, constructors', () => {
    const code = `
      using UnityEngine;

      public class PlayerMovement : MonoBehaviour
      {
        public const float Gravity = 9.81f;

        [SerializeField]
        private float _moveSpeed = 5.0f;

        public int Health { get; set; }

        public PlayerMovement()
        {
        }

        private void Update()
        {
        }

        public void TakeDamage(int amount)
        {
        }
      }
    `;

    const symbols = indexer.parseCSharpCode(code, '/dummy/PlayerMovement.cs', 'Assembly-CSharp');

    const moveSpeed = symbols.find(s => s.name === '_moveSpeed');
    expect(moveSpeed).toBeDefined();
    expect(moveSpeed?.kind).toBe(SymbolKind.Field);
    expect(moveSpeed?.attributes).toContain(UnityAttribute.SerializeField);

    const health = symbols.find(s => s.name === 'Health');
    expect(health).toBeDefined();
    expect(health?.kind).toBe(SymbolKind.Property);

    const update = symbols.find(s => s.name === 'Update');
    expect(update).toBeDefined();
    expect(update?.kind).toBe(SymbolKind.Method);
    expect(update?.isUnityEventFunction).toBe(true);
    expect(update?.unityEventCategory).toBe('UpdateLoop');

    const takeDamage = symbols.find(s => s.name === 'TakeDamage');
    expect(takeDamage).toBeDefined();
    expect(takeDamage?.parameters).toBe('(int amount)');
  });
});
