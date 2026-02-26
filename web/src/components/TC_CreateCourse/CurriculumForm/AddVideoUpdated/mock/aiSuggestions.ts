export const mockAiSuggestions = {
    title: "Hướng dẫn lập trình ReactJS cơ bản cho người mới bắt đầu - Phần 1",
    content: "Trong bài học này, chúng ta sẽ tìm hiểu về các khái niệm cơ bản của ReactJS bao gồm Components, Props và State. Bạn sẽ học cách xây dựng một ứng dụng Todo List đơn giản để áp dụng ngay các kiến thức vừa học. Video cũng bao gồm các best practices khi viết code React."
}

export const fetchMockAiSuggestions = (): Promise<typeof mockAiSuggestions> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(mockAiSuggestions)
        }, 2000)
    })
}

import { LessonChunk } from '@/types/ai'


export const MOCK_CHUNKS: LessonChunk[] = [
    {
        id: '1',
        chunkIndex: 0,
        summary: 'Phần mở đầu giới thiệu chủ đề bài giảng và các khái niệm cơ bản sẽ được trình bày trong video.',
        timestamp: '00:00 → 00:32',
        startTime: '00:00',
        endTime: '00:32',
        sentenceCount: 5,
        content: '',
    },
    {
        id: '2',
        chunkIndex: 1,
        summary: 'Giải thích chi tiết khái niệm đầu tiên kèm ví dụ minh hoạ thực tế giúp người học dễ nắm bắt.',
        timestamp: '00:32 → 01:10',
        startTime: '00:32',
        endTime: '01:10',
        sentenceCount: 8,
        content: '',
    },
    {
        id: '3',
        chunkIndex: 2,
        summary: 'Trình bày khái niệm thứ hai và so sánh với khái niệm trước đó, làm nổi bật điểm khác biệt quan trọng.',
        timestamp: '01:10 → 01:48',
        startTime: '01:10',
        endTime: '01:48',
        sentenceCount: 7,
        content: '',
    },
    {
        id: '4',
        chunkIndex: 3,
        summary: 'Phần kết tóm lại các điểm chính và gợi ý hướng thực hành tiếp theo cho người học.',
        timestamp: '01:48 → 02:16',
        startTime: '01:48',
        endTime: '02:16',
        sentenceCount: 5,
        content: '',
    },
]