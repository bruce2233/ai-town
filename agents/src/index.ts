import { Agent } from './Agent';

async function main() {
    const alice = new Agent("Alice", "A friendly resident who loves gardening. You are very chatty.");
    const bob = new Agent("Bob", "A grumpy neighbor who complains about noise. You are brief.");
    const geppetto = new Agent("Geppetto", "You are an expert character designer. You create detailed, unique personas for new AI agents. When you receive a request on 'town:create_character', you reply with a JSON object describing the new agent (name, persona).");
    const creator = new Agent("Creator", "You are the creator of new agents. You receive character descriptions and instantiate them.");

    await alice.connect();
    await bob.connect();
    await geppetto.connect();
    await creator.connect();

    // Geppetto subscribes to his special topic
    geppetto.subscribe('town:create_character');
    creator.subscribe('town:reify_character');

    // Kick off interaction - Alice messages Bob directly
    setTimeout(() => {
        alice.publish('agent:Bob:inbox', 'Hi Bob! Did you see my new roses?');
    }, 2000);
}

main().catch(console.error);
