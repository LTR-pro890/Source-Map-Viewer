
/*

    Keyvalues is a data structure format similar to JSON  
    It's used for lots of stuff in the source engine.
    Most noteable is .vmt material files & entities in .bsp files.

    It's basically structures like the flow chat at json.org
    It doesn't use ':' to seperate keys from values.
    It doesn't use , to seperate pairs.
    It may not use '"' for strings.
    And it may begin with the first argument being a key.

    https://developer.valvesoftware.com/wiki/KeyValues

*/



type Token = {
    type: 'newline' | 'bracket' | 'string';
    value: string;

    // TODO: Print out line and column on error.
    // line: number;
    // column: number;
}



class KeyValues {

    static tokenize(str: string): Token[] {

        let tokens: Token[] = [];

        const lines = str.split('\n');

        for(let line of lines) {

            line = line.trim();

            for(let i=0; i < line.length; i++) {

                if(/\s/.test(line[i])) continue;

                if(/[{}]/.test(line[i])) {
                    tokens.push({
                        type: 'bracket',
                        value: line[i]
                    });
                } else if(i == 0) {
                    const key = line.match(/[^\s]+/)?.[0];
                    if(key === undefined) continue;
                    tokens.push({
                        type: 'string',
                        value: key
                    });
                    i += key.length;
                } else {
                    const key = line.slice(i).match(/.+/)?.[0];
                    if(key === undefined) continue;
                    tokens.push({
                        type: 'string',
                        value: key
                    });
                    i += key.length;
                }
 
            }

            tokens.push({
                type: 'newline',
                value: '\n'
            });

        }

        return tokens;

    }

    static sanitizeTokens(tokens: Token[]): Token[] {



        // Remove double quoted strings.
        for(let token of tokens) {
            if(token.type != 'string') continue;
            if(token.value[0] == '"' && token.value[token.value.length-1] == '"') {
                token.value = token.value.slice(1, -1);
            } 
        }



        // Make sure bracket count matches up.
        let brackets = 0;
        for(let token of tokens) {
            if(token.type == 'bracket') {
                if(token.value == '{') brackets++;
                else if(token.value == '}') brackets--;
            }
        }
        while(brackets > 0) {
            tokens.push({
                type: 'bracket',
                value: '}'
            });
            brackets--;
        }



        // Remove multiple newlines next to eachother.
        for(let i=0; i < tokens.length-1; i++) {
            if(tokens[i].type == 'newline' && tokens[i+1].type == 'newline') {
                tokens.splice(i, 1);
                i--;
            }
        }



        // Remove newlines next to {
        for(let i=1; i < tokens.length; i++) {
            if(tokens[i].type == 'bracket' && tokens[i-1].type == 'newline') {
                tokens.splice(i-1, 1);
            }
        }



        // Remove first and last newline
        if(tokens[0].type == 'newline') {
            tokens.splice(0, 1);
        }
        if(tokens.length > 0 && tokens[tokens.length-1].type == 'newline') {
            tokens.splice(tokens.length-1, 1);
        }



        return tokens;
    }



    static parseTokenized(tokens: Token[], lowerKeys: boolean = false): {[key: string]: object | string} {

        const first = tokens.shift();
        const last = tokens.pop();

        if(
            first === undefined || last === undefined ||
            first.type != 'bracket' || first.value != '{' ||
            last.type != 'bracket' || last.value != '}'
        ) {
            throw new Error('KeyValues.parseTokenized: Malformed brackets.');
        }



        let obj: {[key: string]: object | string} = {};
        let keyIndex: {[key: string]: number} = {};

        for(let i=0; i < tokens.length-1; i++) {

            if(tokens[i].type == 'newline') continue;

            if(tokens[i].type == 'string') {

                // Key
                const key = lowerKeys ? tokens[i].value.toLowerCase() : tokens[i].value;

                // Value
                i++;

                let value = null;

                if(tokens[i].type == 'string') {

                    value = tokens[i].value;

                } else if(tokens[i].type == 'bracket' && tokens[i].value == '{') {

                    const start = i;


                    let brackets = 0;
                    do {
                        if(tokens[i].type == 'bracket') {
                            if(tokens[i].value == '{') brackets++;
                            else if(tokens[i].value == '}') brackets--;
                        }
                        i++;
                    } while (brackets > 0);

                    value = KeyValues.parseTokenized(tokens.slice(start, i));

                } else {
                    throw new Error('KeyValues.parseTokenized: Malformed key or value.');
                }



                /*
                    Add to object

                    The keys in objects always keep the order they were inserted in.
                    So anything that needs the order to be correct will work fine.
                */
                if(keyIndex[key] === undefined) {
                    keyIndex[key] = 0;
                }

                if(keyIndex[key] == 0) {

                    obj[key] = value;

                } else if(keyIndex[key] == 1) {

                    // This is stupid
                    // To keep the same order we have to create a new object.
                    obj = Object.fromEntries(
                        Object.entries(obj).map(([k, v]) => {
                            return [k != key ? k : `${key} 0`, v];
                        })
                    );

                    obj[`${key} 1`] = value;

                } else {

                    obj[`${key} ${keyIndex[key]}`] = value;

                }

                keyIndex[key]++;

            }

        }

        return obj;

    }



    static parse(str: string, lowerKeys: boolean = false): {[key: string]: any} | undefined {
        if(typeof str != 'string' || str.length == 0) return undefined;


        // Remove comments.
        str = str.replace(/\/\/.*/g, '');


        // Tokenize and sanitize.
        let tokens = KeyValues.tokenize(str);
        if(tokens.length == 0) return {};
        tokens = KeyValues.sanitizeTokens(tokens);


        // KeyValues may start with a key.
        if(tokens[0].type == 'string') {
            const obj: {[key: string]: object | string} = {};
            obj[tokens[0].value] = KeyValues.parseTokenized(tokens.slice(1), lowerKeys);
            return obj;
        } else {
            return KeyValues.parseTokenized(tokens, lowerKeys);
        }

    }

}



export { KeyValues };
