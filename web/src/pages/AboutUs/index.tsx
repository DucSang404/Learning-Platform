import { MapPin, Phone, Globe, Mail, Users, Target, Award, BookOpen, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import heroImage from '@/assets/images/cover-learnova.jpg'
import missionImage from '@/assets/images/about1.jpg'
import facebookIcon from '@/assets/images/fb.png'
import ytbIcon from '@/assets/images/ytb.png'
import igIcon from '@/assets/images/ig.png'
import linkedIcon from '@/assets/images/linked.png'
import './style.scss'

const About = () => {
  const stats = [
    { icon: Users, label: 'Học viên', value: '1,000+' },
    { icon: BookOpen, label: 'Khóa học', value: '500+' },
    { icon: Award, label: 'Giảng viên', value: '200+' },
    { icon: TrendingUp, label: 'Tỷ lệ hoàn thành', value: '92%' }
  ]

  return (
    <div className='min-h-screen bg-background'>
      {/* Hero Section */}
      <section className='relative overflow-hidden banner-about-us-container'>
        <div className='absolute inset-0 bg-cover bg-center' style={{ backgroundImage: `url(${heroImage})` }}>
          <div className='absolute inset-0 bg-gradient-to-r from-primary/60 to-primary/20' />
        </div>

        {/* Center content vertically */}
        <div className='relative flex items-center justify-center'>
          <div className='mx-auto my-32 max-w-7xl px-4'>
            <div className='max-w-3xl mx-auto text-center animate-in fade-in slide-in-from-bottom-4 duration-1000'>
              <h1 className='scroll-m-20 text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-white mb-4'>
                Về Learnova
              </h1>

              <p className='text-base md:text-lg lg:text-xl text-white/90 mb-6'>
                Nền tảng học trực tuyến hàng đầu, mang đến kiến thức chất lượng cho hàng chục ngàn học viên.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className='py-12 bg-card border-b'>
        <div className='container px-4'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8'>
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <div
                  key={index}
                  className='text-center animate-in fade-in slide-in-from-bottom-4 duration-700 hover:scale-105 transition-transform rounded-lg p-4 md:p-6 bg-card shadow-elegant'
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className='inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary/10 text-primary mb-4'>
                    <Icon className='w-6 h-6 md:w-8 md:h-8' />
                  </div>

                  <div className='text-2xl md:text-3xl font-bold text-foreground mb-1'>
                    {stat.value}
                  </div>

                  <div className='text-xs md:text-base text-muted-foreground'>
                    {stat.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className='py-12 md:py-20 px-4'>
        <div className='container'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center'>
            <div className='animate-in fade-in slide-in-from-left-8 duration-1000 flex justify-center items-center order-2 md:order-1'>
              <img
                src={missionImage}
                alt='Mission'
                className='rounded-2xl shadow-elegant w-full md:w-[450px] h-auto md:h-[450px] object-cover'
              />
            </div>

            <div className='animate-in fade-in slide-in-from-right-8 duration-1000 order-1 md:order-2'>
              <div className='inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6'>
                <Target className='w-5 h-5' />
                <span className='font-semibold text-sm md:text-base'>Sứ mệnh</span>
              </div>

              <h2 className='text-2xl md:text-4xl font-bold text-foreground mb-6'>
                Cách mạng giáo dục
              </h2>

              <p className='text-base md:text-lg text-muted-foreground mb-4 text-justify'>
                Learnova được thành lập với sứ mệnh mang giáo dục chất lượng cao đến với mọi người, không phân biệt địa
                lý hay hoàn cảnh. Chúng tôi tin rằng học tập là chìa khóa mở ra những cơ hội mới trong cuộc sống.
              </p>

              <p className='text-base md:text-lg text-muted-foreground text-justify'>
                Với đội ngũ giảng viên dày dặn kinh nghiệm và nền tảng công nghệ hiện đại, chúng tôi cam kết cung cấp
                trải nghiệm học tập tối ưu, giúp học viên phát triển kỹ năng và đạt được mục tiêu nghề nghiệp.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className='py-12 md:py-20 px-4'>
        <div className='container max-w-5xl'>
          <div className='text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700'>
            <div className='inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6'>
              <Mail className='w-5 h-5' />
              <span className='font-semibold text-sm md:text-base'>Liên hệ</span>
            </div>

            <h2 className='text-2xl md:text-4xl font-bold text-foreground mb-4'>
              Gửi tin nhắn cho chúng tôi
            </h2>

            <p className='text-base md:text-lg text-muted-foreground'>
              Bạn có câu hỏi? Hãy để lại thông tin, chúng tôi sẽ liên hệ ngay!
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-start shadow-sm'>
            {/* Contact info */}
            <div className='space-y-6 animate-in fade-in slide-in-from-left-8 duration-1000'>
              <Card className='p-4 md:p-6 shadow-elegant bg-card'>
                <h3 className='text-base md:text-lg font-semibold text-foreground'>
                  Thông tin liên hệ
                </h3>

                <div className='space-y-4 text-muted-foreground'>
                  <div className='flex items-start gap-3 text-xs md:text-base font-semibold'>
                    <MapPin className='w-6 h-6 md:w-8 md:h-8 text-blue-500 flex-shrink-0 mt-1' />
                    <p>Thành phố Hồ Chí Minh</p>
                  </div>

                  <div className='flex items-center gap-3 text-xs md:text-base font-semibold'>
                    <Phone className='w-6 h-6 md:w-8 md:h-8 text-blue-500 flex-shrink-0' />
                    <p>0856230324</p>
                  </div>

                  <div className='flex items-center gap-3 text-xs md:text-base font-semibold'>
                    <Mail className='w-6 h-6 md:w-8 md:h-8 text-blue-500 flex-shrink-0' />
                    <p>learnova.hello@gmail.com</p>
                  </div>

                  <div className='flex items-center gap-3 text-xs md:text-base font-semibold'>
                    <Globe className='w-6 h-6 md:w-8 md:h-8 text-blue-500 flex-shrink-0' />
                    <p>learnova.t9tieanh.io.vn</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Social media */}
            <Card className='p-4 md:p-6 shadow-elegant bg-card shadow-sm'>
              <h3 className='text-base md:text-lg font-semibold text-foreground'>
                Mạng xã hội
              </h3>

              <div className='space-y-4 text-muted-foreground'>
                <a
                  href='https://www.facebook.com/profile.php?id=61569020296267'
                  className='flex items-center gap-3 text-xs md:text-base font-semibold hover:text-primary transition-colors'
                >
                  <img src={facebookIcon} alt='Facebook' className='w-6 h-6 md:w-8 md:h-8 rounded-sm' />
                  <p>@learnova</p>
                </a>

                <a
                  href='https://www.instagram.com/learnova/'
                  className='flex items-center gap-3 text-xs md:text-base font-semibold hover:text-primary transition-colors'
                >
                  <img src={igIcon} alt='Instagram' className='w-6 h-6 md:w-8 md:h-8' />
                  <p>@learnova</p>
                </a>

                <a
                  href='https://www.linkedin.com/in/learnova-vn-222981393/'
                  className='flex items-center gap-3 text-xs md:text-base font-semibold hover:text-primary transition-colors'
                >
                  <img src={linkedIcon} alt='LinkedIn' className='w-6 h-6 md:w-8 md:h-8' />
                  <p>@learnova</p>
                </a>

                <a
                  href='https://www.youtube.com/@LearnovaAcademy'
                  className='flex items-center gap-3 text-xs md:text-base font-semibold hover:text-primary transition-colors'
                >
                  <img src={ytbIcon} alt='YouTube' className='w-6 h-6 md:w-8 md:h-8' />
                  <p>@learnova</p>
                </a>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}

export default About