import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsISO31661Alpha2, IsOptional } from 'class-validator';
import type {
  TrendItem,
  TrendNews,
  TrendSnapshot,
  TrendSource,
} from '../trends.types.js';

export class TrendsQueryDto {
  @ApiPropertyOptional({
    description:
      'Audience country, ISO 3166-1 alpha-2. Defaults to the workspace’s audience country.',
    example: 'UG',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsISO31661Alpha2({
    message: 'Choose a country using its 2-letter code, like UG or KE',
  })
  country?: string;
}

export class TrendNewsDto implements TrendNews {
  @ApiProperty() title: string;
  @ApiProperty() url: string;
  @ApiProperty({ example: 'Reuters' }) source: string;
}

export class TrendItemDto implements TrendItem {
  @ApiProperty({ enum: ['google_trends', 'mastodon', 'bluesky'] })
  source: TrendSource;

  @ApiProperty({
    enum: ['country', 'global'],
    description:
      'country: Google Trends for the requested country. global: platform-wide (Mastodon, Bluesky), not country-specific.',
  })
  scope: 'country' | 'global';

  @ApiProperty({ example: 'kenya airways' }) term: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '2,000+',
    description:
      'Approximate Google searches (google_trends) or posts in the latest day (mastodon); null for bluesky.',
  })
  traffic: string | null;

  @ApiProperty({ type: String, nullable: true }) url: string | null;

  @ApiProperty({
    type: [TrendNewsDto],
    description: 'Related headlines (google_trends only)',
  })
  news: TrendNewsDto[];

  @ApiProperty({ format: 'date-time' }) observedAt: string;
}

export class TrendSnapshotDto implements TrendSnapshot {
  @ApiProperty({ example: 'UG' }) country: string;

  @ApiProperty({
    format: 'date-time',
    description: 'When the oldest part of this snapshot was fetched',
  })
  updatedAt: string;

  @ApiProperty({ type: [TrendItemDto] }) items: TrendItemDto[];

  @ApiProperty({
    type: [String],
    description:
      'Plain notes for people, e.g. that Google Trends has no list for this country or a source couldn’t be reached',
  })
  notes: string[];
}
