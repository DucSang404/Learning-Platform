import { IsString, IsNotEmpty } from 'class-validator'

export class UpdateChunkSummaryDto {
    @IsString({ message: 'Tóm tắt (summary) phải là một chuỗi ký tự' })
    @IsNotEmpty({ message: 'Tóm tắt không được để trống' })
    summary!: string
}
