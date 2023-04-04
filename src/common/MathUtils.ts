
namespace MathUtils {
    
    /**
     * Rounds to nearest nth decimal  
     * `roundToNthDecimal(3.14159, 3) -> 3.141`  
     * @param n - Decimal to round to  
     * @param method - Rounding method function (default: Math.floor)  
     */
    export function roundToNthDecimal(number: number, n: number = 3, method: (v: number) => number = Math.floor): number {
        if(n < 0 || n % 1 != 0) {
            throw new RangeError(`MathUtils.roundToNthDecimal: Cannot round to invalid decimal! ${n}`);
        }
        n = 10 ** n;
        return method(number * n) / n;
    }

    /**
     * Rounds to nearest nth digit  
     * `roundToNthDigit(69,420, 3) -> 69,000`  
     * @param n - Digit to round to  
     * @param method - Rounding method function (default: Math.floor)  
     */
    export function roundToNthDigit(number: number, n: number = 3, method: (v: number) => number = Math.floor): number {
        if(n < 0 || n % 1 != 0) {
            throw new RangeError(`MathUtils.roundToNthDigit: Cannot round to invalid digit! ${n}`);
        }
        n = 10 ** n;
        return method(number / n) * n;
    }

    /**
     * Rounds to nearest nth digit/decimal  
     * `roundToNth(3.14159, -3) -> 3.141`  
     * `roundToNth(69,420, 3) -> 69,000`  
     * @param n - Digit/decimal to round to - Negative to decimal, Positive to digit  
     * @param method - Rounding method function (default: Math.floor)  
     */
    export function roundToNth(number: number, n: number = 3, method: (v: number) => number = Math.floor): number {
        if(n == 0) {
            return method(number); // Useless?
        } else if(n > 0) {
            return MathUtils.roundToNthDigit(number, n, method);
        } else {
            return MathUtils.roundToNthDecimal(number, Math.abs(n), method);
        }
    }



    /**
     * Linear interpolate.  
     */
    export function lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    /**
     * Bilinear interpolation.  
     */
    export function bilinear(a: number, b: number, c: number, d: number, t1: number, t2: number): number {
        // return MathUtils.lerp(MathUtils.lerp(a, b, t1), MathUtils.lerp(c, d, t1), t2);
        return (1 - t1) * (1 - t2) * a + t1 * (1 - t2) * b + (1 - t1) * t2 * c + t1 * t2 * d; 
    }



    /**
     * Clamps number to lower and upper bounds.  
     */
    export function clamp(value: number, min: number, max: number): number {
        if(value < min) return min;
        if(value > max) return max;
        return value;
    }



    /**
     * Rounds to nearest power of 2.  
     * @param method - Rounding method function (default: Math.ceil)  
     */
    export function nearestPowerOf2(value: number, method: (v: number) => number = Math.ceil): number {
        const log2 = Math.log(2);
        return 2 ** method(Math.log(value) / log2);
    }



    /**
     * Reverses bits in any byte length number.
     */
    export function reverseBits(value: number, numBits: number): number {
        let reversed = 0;
        for(let i=0; i < numBits; i++) {
            if(value & (1 << i)) {
                reversed |= 1 << ((numBits - 1) - i);
            }
        }
        return reversed;
    }



    export function isInRange(x: number, x1: number, x2: number): boolean {
        // Force x1 to be lower bound.
        if(x1 > x2) {
            const l = x2;
            x2 = x1;
            x1 = l;
        }

        // Is in bounds.
        if(x < x1) return false;
        if(x > x2) return false;
        return true;
    }

    export function isInRange2(x: number, y: number, x1: number, x2: number, y1: number, y2: number): boolean {
        return (MathUtils.isInRange(x, x1, x2) && MathUtils.isInRange(y, y1, y2));
    }

}



export { MathUtils };
