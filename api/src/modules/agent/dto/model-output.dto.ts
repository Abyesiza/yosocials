import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Shapes the model must return. Model output is untrusted, so it is validated
 * against these classes before anything is saved.
 */

export class ModelTargetOutput {
  @IsString()
  accountId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  text: string;

  /** The audience-local day, "YYYY-MM-DD"; the engine picks the time. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;
}

export class ModelPostOutput {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  idea: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModelTargetOutput)
  targets: ModelTargetOutput[];
}

export class ModelCalendarOutput {
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => ModelPostOutput)
  posts: ModelPostOutput[];
}

export class ModelVariantOutput {
  @IsString()
  accountId: string;

  @IsString()
  @MinLength(1)
  text: string;
}

export class ModelVariantsOutput {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModelVariantOutput)
  variants: ModelVariantOutput[];
}
