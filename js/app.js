import { fetchPokemon } from "./api.js";

//test API
async function testAPI(nameOrID) {
    try{
        const pokemon = await fetchPokemon(nameOrID);
        console.log('Pokemon Data: ', pokemon)
    } catch (error) {
        console.error("Test failed:", error);
    }
}

testAPI('Kyogre');