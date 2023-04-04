


namespace ObjectUtils {

    /**
     * Gets [key, value] iterator.  
     *   
     * ```TypeScript
     * for(const [key, value] of ObjectUtils.kvIter(obj)) {
     *     console.log(key, value);
     * }
     * ```  
     */
    export function* kvIter<T>(obj: {[key: string]: T}): IterableIterator<[string, T]> {

        for(const key in obj) {
            yield [ key, obj[key] ];
        }

    }


    
    /**
     * ```TypeScript
     * ObjectUtils.mergeDeep(
     *     target: {
     *          key1: 'hello',
     *          key2: 'world'
     *     },
     *     obj: {
     *          key1: 'bye',
     *          key3: 'yep.'
     *     }
     * ) -> target: {
     *     key1: 'bye',
     *     key2: 'world',
     *     key3: 'yep.'
     * }
     * ```  
     */
    export function mergeDeep<T extends {[key: string]: any}>(target: T, obj: {[key: string]: any}): T {

        for(const key in target) {

            if(!(key in obj)) continue;

            if(typeof target[key] == 'object' && typeof obj[key] == 'object') {

                mergeDeep(target[key], obj[key]);

            } else {
                
                target[key] = obj[key];

            }
            
        }

        return target;

    }
    
}



export { ObjectUtils };
