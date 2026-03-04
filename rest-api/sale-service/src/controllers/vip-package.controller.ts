import { Request, Response, NextFunction } from 'express';
import vipPackageService from '~/service/models/vip-package.service';
import sendResponse from '~/dto/response/send-response';
import ApiError from '~/middleware/ApiError';

class VipPackageController {
    async getVipPackages(req: Request, res: Response, next: NextFunction) {
        try {
            const packages = await vipPackageService.getVipPackages();
            sendResponse(res, {
                code: 200,
                message: 'Lấy danh sách gói VIP thành công !',
                result: packages
            });
        } catch (error) {
            next(error);
        }
    }

    async getVipPackageByDuration(req: Request, res: Response, next: NextFunction) {
        try {
            const duration = parseInt(req.params.duration);
            if (isNaN(duration)) {
                throw new ApiError(400, 'Thời hạn không hợp lệ');
            }
            const vipPackage = await vipPackageService.getVipPackageByDuration(duration);
            sendResponse(res, {
                code: 200,
                message: 'Lấy thông tin gói VIP thành công !',
                result: vipPackage
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new VipPackageController();
