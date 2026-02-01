import axiosClient from '@/lib/axiosClient.lib'

class EventTrackerService {
  async trackingEvent(eventName: string, courseId?: string) {
    const data: {
      eventName: string
      payload?: Record<string, string>
    } = {
      eventName
    }

    if (courseId) {
      data.payload = {
        courseId
      }
    }
    const response = await axiosClient.axiosInstance.post('user/track-event', data)
    return response.data
  }
}

export default new EventTrackerService()
