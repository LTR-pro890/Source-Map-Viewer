


namespace StringUtils {

    /**
     * Number to hex string
     */
    export function hex(code: number = 0, length: number = 1, start: string = '0x', uppercase: boolean = true): string {
        length *= 2;
        if(!uppercase) {
            return start + code.toString(16).padStart(length, '0');
        }
        return start + code.toString(16).toUpperCase().padStart(length, '0');
    }



    export function escapeRegex(str: string): string {
        return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
    }



    /**
     * Match a string against a wildcard.  
     *   
     * https://stackoverflow.com/questions/26246601/wildcard-string-comparison-in-javascript#answer-32402438  
     *   
     * @param str - String to match against.  
     * @param rule - Rule to check if string matches.  
     */
    export function wildcardMatches(str: string, rule: string): boolean {
        const regex = new RegExp(`^${rule.split('*').map(escapeRegex).join('.*')}$`);

        return regex.test(str);
    }

}



export { StringUtils };
