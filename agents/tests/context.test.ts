import { ContextState, templateString } from '../src/ContextState';

describe('ContextState', () => {
    let context: ContextState;

    beforeEach(() => {
        context = new ContextState();
    });

    test('should set and get values', () => {
        context.set('foo', 'bar');
        expect(context.get('foo')).toBe('bar');
    });

    test('should return undefined for missing keys', () => {
        expect(context.get('missing')).toBeUndefined();
    });

    test('should list keys', () => {
        context.set('a', 1);
        context.set('b', 2);
        expect(context.get_keys()).toEqual(expect.arrayContaining(['a', 'b']));
    });
});

describe('templateString', () => {
    let context: ContextState;

    beforeEach(() => {
        context = new ContextState();
        context.set('name', 'World');
    });

    test('should replace placeholders', () => {
        const result = templateString('Hello, ${name}!', context);
        expect(result).toBe('Hello, World!');
    });

    test('should handle missing keys gracefully', () => {
        const result = templateString('Hello, ${missing}!', context);
        expect(result).toBe('Hello, !');
    });
});
