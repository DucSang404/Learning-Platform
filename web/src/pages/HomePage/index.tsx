import { Banner } from '@/components/HomePage/Banner'
import CourseList from '@/components/HomePage/CourseList'
import TrendingCategories from '@/components/HomePage/TrendingCategories'
import WhyChooseUsSection from '@/components/HomePage/WhyChooseUsSection'
import HighlightedArticles from '@/components/HomePage/HighlightedArticles'
import courseService from '@/services/course/course-user.service'
import { TestimonialsCarousel } from '@/components/HomePage/StudentCarousel/TestimonialsCarousel'

const HomePage = () => {
  return (
    <div className='home-page-container '>
      <Banner />
      <CourseList title='Khóa học gợi ý' fetcher={courseService.getPersonalizationCourse} />
      <CourseList title='Khóa học bán chạy' fetcher={courseService.getBestSellerCourses} />
      <TrendingCategories />
      <WhyChooseUsSection />
      <TestimonialsCarousel />
      <HighlightedArticles />
    </div>
  )
}

export default HomePage
