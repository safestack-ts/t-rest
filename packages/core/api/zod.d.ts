import { z } from 'zod';

declare namespace ze {
    const booleanString: () => z.ZodString & z.ZodType<"true" | "false", string, z.core.$ZodTypeInternals<"true" | "false", string>>;
    const numberString: () => z.ZodString;
    const integerString: () => z.ZodString;
    const floatString: () => z.ZodString;
    const dateString: () => z.ZodString;
    const iso8601DateString: () => z.ZodString;
    const uuid: () => z.ZodString;
    const jsonString: <T extends z.ZodTypeAny>(zodType: T) => z.ZodString;
    const jsonObject: <TOutputValue>(objectValidator: z.ZodType<TOutputValue, unknown>) => z.ZodUnion<[z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<any, string>>, z.ZodType<TOutputValue, unknown, z.core.$ZodTypeInternals<TOutputValue, unknown>>>, z.ZodType<TOutputValue, unknown, z.core.$ZodTypeInternals<TOutputValue, unknown>>]>;
    const databaseId: () => z.ZodNumber;
    const parseInteger: () => z.ZodType<number, number | string>;
    const parseFloating: () => z.ZodType<number, number | string>;
    const parseBoolean: () => z.ZodType<boolean, boolean | string>;
    const parseDate: () => z.ZodUnion<[z.ZodPipe<z.ZodString, z.ZodTransform<Date, string>>, z.ZodDate]>;
    const parseCSV: () => z.ZodPipe<z.ZodString, z.ZodTransform<string[], string>>;
    const parseCSVTrimmed: () => z.ZodPipe<z.ZodString, z.ZodTransform<string[], string>>;
    const parseCSVInteger: () => z.ZodPipe<z.ZodString, z.ZodTransform<number[], string>>;
    const parseJSON: () => z.ZodPipe<z.ZodString, z.ZodTransform<any, string>>;
    const file: () => z.ZodObject<{
        buffer: z.ZodCustom<Buffer<ArrayBufferLike>, Buffer<ArrayBufferLike>>;
        encoding: z.ZodString;
        fieldname: z.ZodString;
        mimetype: z.ZodString;
        originalname: z.ZodString;
        size: z.ZodNumber;
    }, z.core.$strip>;
    const parseDatabaseId: () => z.ZodPipe<z.ZodType<number, string | number, z.core.$ZodTypeInternals<number, string | number>>, z.ZodNumber>;
}

export { ze };
