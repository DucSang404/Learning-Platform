import React from 'react'
import CustomDialog from '@/components/common/Dialog'
import CustomButton from '@/components/common/Button'
import { Check, Sparkles, Crown, Zap, FileText } from 'lucide-react'
import learnovaLogo from '@/assets/images/logo1.png'

interface VipUpgradeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpgrade?: () => void
}

const features = [
    {
        title: 'Trợ lý AI phân tích nội dung',
        description: 'Tự động chia nhỏ video và tài liệu thành các phân đoạn học.',
    },
    {
        title: 'Tự động tạo tóm tắt chi tiết',
        description: 'AI tự động tóm tắt kiến thức cốt lõi cho từng bài giảng.',
    },
    {
        title: 'Gợi ý tiêu đề bài học thông minh',
        description: 'Phân tích nội dung và đưa ra tiêu đề thu hút người học.',
    },
    {
        title: 'Truy cập sớm các tính năng mới',
        description: 'Luôn là người đầu tiên trải nghiệm tính năng AI mới nhất.',
    },
]

const VipUpgradeDialog: React.FC<VipUpgradeDialogProps> = ({
    open,
    onOpenChange,
    onUpgrade,
}) => {
    return (
        <CustomDialog
            open={open}
            setOpen={onOpenChange}
            title={<span className="sr-only">Nâng cấp VIP</span>}
            size="xl"
            className="w-[95vw] max-w-5xl p-0 overflow-hidden bg-white border-0 shadow-2xl rounded-3xl gap-0 border-none"
            contentClassName="my-0 w-full"
        >
            <div className="flex flex-col md:flex-row h-auto md:h-[600px] max-h-[85vh] overflow-y-auto md:overflow-hidden">
                {/* Left Pane - Feature List */}
                <div className="flex-1 p-6 sm:p-10 md:p-14 flex flex-col justify-center bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
                    <div className="flex items-center gap-2 mb-6 md:mb-8">
                        <img src={learnovaLogo} alt="Learnova" className="h-6 md:h-8 w-auto object-contain" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight mb-2 tracking-tight">
                        Gói Thành Viên <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-600">VIP</span>
                    </h2>
                    <p className="text-blue-600 font-semibold text-lg md:text-xl mb-6 md:mb-8 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" /> Tối ưu hóa khóa học với AI
                    </p>

                    <ul className="space-y-4 md:space-y-5">
                        {features.map((feature, index) => (
                            <li key={index} className="flex gap-4">
                                <div className="flex-shrink-0 mt-0.5">
                                    <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-200">
                                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-gray-900 font-medium text-[15px]">{feature.title}</h4>
                                    <p className="text-gray-500 text-sm mt-0.5 leading-relaxed">{feature.description}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Right Pane - Call to Action visual */}
                <div className="w-full md:w-[400px] bg-white p-6 sm:p-8 md:p-10 flex flex-col justify-between shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-10 relative">
                    {/* Decorative background element */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-yellow-100/40 to-orange-100/40 rounded-bl-full -z-10 blur-2xl hidden md:block"></div>

                    <div className="space-y-6">
                        <div className="inline-flex items-center justify-center p-3 bg-yellow-100 rounded-2xl mb-2 text-yellow-600">
                            <Crown className="w-8 h-8" />
                        </div>

                        <h3 className="text-xl md:text-2xl font-bold text-gray-900 leading-snug uppercase tracking-wide">
                            Bắt đầu kiếm thêm<br className="hidden md:block" /> thu nhập ngay!
                        </h3>

                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-2xl text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                            {/* Subtle pattern inside the card */}
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Zap className="w-24 h-24" />
                            </div>
                            <div className="relative z-10 space-y-3 md:space-y-4">
                                <p className="font-semibold text-base md:text-lg flex items-center gap-2">
                                    <FileText className="w-5 h-5" />
                                    Chỉ cần tải video lên
                                </p>
                                <p className="text-blue-100 text-xs md:text-sm leading-relaxed">
                                    Mọi việc phân tích, chia nhỏ bài học và tạo tóm tắt chuyên sâu cứ để AI của chúng tôi lo.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <p className="text-center text-[11px] md:text-xs text-gray-400 mb-4 px-2 md:px-4 leading-relaxed">
                            Bằng cách nâng cấp, bạn đồng ý với <a href="#" className="underline hover:text-gray-700">Điều khoản & Điều kiện</a> của chúng tôi.
                        </p>
                        <CustomButton
                            label="NÂNG CẤP VIP NGAY"
                            className="w-full h-12 text-sm font-bold tracking-wider rounded-xl bg-gray-900 hover:bg-gray-800 text-white shadow-md transition-all hover:-translate-y-0.5"
                            onClick={() => {
                                if (onUpgrade) onUpgrade()
                                onOpenChange(false)
                            }}
                        />
                    </div>
                </div>
            </div>
        </CustomDialog>
    )
}

export default VipUpgradeDialog
