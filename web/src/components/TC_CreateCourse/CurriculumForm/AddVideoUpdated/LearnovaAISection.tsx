import React, { useState } from 'react'
import {
    Sparkles,
    Crown,
    ChevronDown,
    Brain,
    FileSearch,
    Pencil,
} from 'lucide-react'
import learnovaLogo from '@/assets/images/logo1.png'
import CustomButton from '@/components/common/Button'
import ChunkCard from './ChunkCard'
import { LessonChunk } from '@/types/ai'
import { MOCK_CHUNKS } from './mock/aiSuggestions'

interface LearnovaAISectionProps {
    /** For now we assume all users are VIP */
    isVip?: boolean
    /** Pass real chunks from API later */
    chunks?: LessonChunk[]
    /** Seek video preview to the chunk's start time */
    onSeek?: (startTime: string | null) => void
}

const LearnovaAISection: React.FC<LearnovaAISectionProps> = ({
    isVip = true,
    chunks: propChunks,
    onSeek,
}) => {
    const [chunks, setChunks] = useState<LessonChunk[]>(propChunks ?? MOCK_CHUNKS)
    const [isCollapsed, setIsCollapsed] = useState(false)

    const handleSaveSummary = (id: string, newSummary: string) => {
        setChunks((prev) =>
            prev.map((c) => (c.id === id ? { ...c, summary: newSummary } : c))
        )
        // TODO: call API to persist chunk summary
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* ── Section Header ── */}
            <div
                className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 cursor-pointer"
                onClick={() => setIsCollapsed((v) => !v)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        <Brain className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-white font-semibold text-sm">Phân tích từ</h3>
                            <img src={learnovaLogo} alt="Learnova AI" className="h-4 w-auto object-contain brightness-0 invert" />
                        </div>
                        <p className="text-blue-100 text-xs mt-0.5">
                            {chunks.length} phân đoạn nội dung đã được phân tích
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* VIP badge */}
                    {isVip && (
                        <div className="flex items-center gap-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
                            <Crown className="w-3 h-3" />
                            VIP
                        </div>
                    )}
                    {/* Animated chevron */}
                    <ChevronDown
                        className={`w-5 h-5 text-white/70 transition-transform duration-300 ease-in-out ${isCollapsed ? 'rotate-0' : 'rotate-180'
                            }`}
                    />
                </div>
            </div>

            {/* ── VIP Gate (non-VIP placeholder) ── */}
            {!isVip && (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-gray-50">
                    <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mb-3">
                        <Crown className="w-7 h-7 text-yellow-500" />
                    </div>
                    <h4 className="font-semibold text-gray-700 mb-1">Tính năng dành cho thành viên VIP</h4>
                    <p className="text-sm text-gray-500 max-w-xs">
                        Nâng cấp tài khoản để xem và chỉnh sửa kết quả phân tích nội dung từ Learnova AI.
                    </p>
                    <CustomButton
                        type="button"
                        label="Nâng cấp VIP"
                        icon={<Sparkles className="w-4 h-4 mr-2" />}
                        className="mt-4 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-xl px-5"
                    />
                </div>
            )}

            {/* ── Chunk List – smooth grid-rows transition ── */}
            {isVip && (
                <div
                    className={`grid transition-all duration-300 ease-in-out ${isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
                        }`}
                >
                    <div className="overflow-hidden">
                        <div className="p-4 space-y-3">
                            {/* Info banner */}
                            <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg">
                                <FileSearch className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                <span>
                                    Learnova AI đã chia nội dung thành <strong>{chunks.length} phân đoạn</strong> ngữ nghĩa.
                                    Nhấn <Pencil className="w-3 h-3 inline mx-0.5" /> để chỉnh sửa tóm tắt nếu có sai sót.
                                </span>
                            </div>

                            {/* Chunk cards */}
                            {chunks.map((chunk) => (
                                <ChunkCard
                                    key={chunk.id}
                                    chunk={chunk}
                                    onSaveSummary={handleSaveSummary}
                                    onSeek={onSeek}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default LearnovaAISection
