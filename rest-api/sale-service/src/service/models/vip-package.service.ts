import prismaService from '~/service/utils/prisma.service'
import ApiError from '~/middleware/ApiError';
import { VipPackage } from '@prisma/client';

class VipPackageService {
    async getVipPackages(): Promise<VipPackage[]> {
        return await prismaService.vipPackage.findMany();
    }

    async getVipPackageByDuration(durationMonths: number): Promise<VipPackage> {
        const vipPackage = await prismaService.vipPackage.findFirst({
            where: { duration_months: durationMonths }
        });

        if (!vipPackage) {
            throw new ApiError(404, `Không tìm thấy gói VIP với thời hạn ${durationMonths} tháng`);
        }
        return vipPackage;
    }
}

export default new VipPackageService();
