import { Router } from 'express';
import vipPackageController from '~/controllers/vip-package.controller';

export const vipPackageRouter = Router();

vipPackageRouter.get('/', vipPackageController.getVipPackages);
vipPackageRouter.get('/:duration', vipPackageController.getVipPackageByDuration);

export default vipPackageRouter;
