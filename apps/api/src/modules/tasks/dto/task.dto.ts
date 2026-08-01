import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BlockerCategory, Priority, TaskStatus } from '@maher/database';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListTasksDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mine?: boolean;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}

export class TaskProgressDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  percent!: number;
}

export class TaskBlockDto {
  @ApiProperty({ enum: BlockerCategory })
  @IsEnum(BlockerCategory)
  category!: BlockerCategory;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  reason!: string;
}

export class AssignTaskDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}

export class CompleteTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsUUID('4', { each: true })
  photoDocumentIds?: string[];
}

export class UpdateTaskNotesDto {
  @ApiProperty()
  @IsString()
  notes!: string;
}
