import { Router } from 'express'
import { authenticateUser } from '../../../middlewares/auth.middleware'
import { AddressService } from '../services/address.service'

const router = Router()

// All address routes require authentication
router.use(authenticateUser)

// Get all addresses
router.get('/', AddressService.getAddresses)

// Add new address
router.post('/', AddressService.addAddress)

// Update address
router.put('/:addressId', AddressService.updateAddress)

// Delete address
router.delete('/:addressId', AddressService.deleteAddress)

// Set default address
router.patch('/:addressId/default', AddressService.setDefaultAddress)

export default router
