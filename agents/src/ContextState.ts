// --- Qwen Code Inspired Components ---

/**
 * Manages the runtime context state for the subagent.
 * This class provides a mechanism to store and retrieve key-value pairs
 * that represent the dynamic state and variables accessible to the subagent
 * during its execution.
 */
export class ContextState {
    private state: Record<string, unknown> = {};

    /**
     * Retrieves a value from the context state.
     *
     * @param key - The key of the value to retrieve.
     * @returns The value associated with the key, or undefined if the key is not found.
     */
    get(key: string): unknown {
        return this.state[key];
    }

    /**
     * Sets a value in the context state.
     *
     * @param key - The key to set the value under.
     * @param value - The value to set.
     */
    set(key: string, value: unknown): void {
        this.state[key] = value;
    }

    /**
     * Retrieves all keys in the context state.
     *
     * @returns An array of all keys in the context state.
     */
    get_keys(): string[] {
        return Object.keys(this.state);
    }
}

/**
 * Replaces `${...}` placeholders in a template string with values from a context.
 */
export function templateString(template: string, context: ContextState): string {
    const placeholderRegex = /\$\{(\w+)\}/g;
    return template.replace(placeholderRegex, (_match, key) =>
        String(context.get(key) ?? '')
    );
}
