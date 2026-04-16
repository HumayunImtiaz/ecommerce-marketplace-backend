import { Request, Response } from 'express'
import prisma from '../../../config/prisma'

type AuthRequest = Request & {
  authUser?: any
}

export class AddressService {
  // Add a new address
  static async addAddress(req: AuthRequest, res: Response) {
    try {
      const userId = (req.authUser)?.id
      const {
        name,
        street,
        city,
        state,
        zipCode,
        country,
        latitude,
        longitude,
        isDefault,
      } = req.body

      // Validation
      if (!street || !city || latitude === undefined || longitude === undefined) {
        return res
          .status(400)
          .json({
            success: false,
            message: 'Street, city, latitude, and longitude are required',
            data: null,
          })
      }

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found', data: null })
      }

      const existingAddresses = await prisma.address.findMany({ where: { userId } })

      // If this is the first address or isDefault is true, make it default
      const shouldBeDefault = isDefault || existingAddresses.length === 0

      // If setting as default, remove default from other addresses
      if (shouldBeDefault && existingAddresses.length > 0) {
        await prisma.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        })
      }

      // Add new address
      await prisma.address.create({
        data: {
          userId,
          name: name || 'Home',
          street,
          city,
          state: state || '',
          zipCode: zipCode || '',
          country: country || 'Pakistan',
          latitude,
          longitude,
          isDefault: shouldBeDefault,
        },
      })

      const addresses = await prisma.address.findMany({ where: { userId } })

      return res
        .status(201)
        .json({
          success: true,
          message: 'Address added successfully',
          data: addresses,
        })
    } catch (error) {
      console.error('Add address error:', error)
      return res
        .status(500)
        .json({ success: false, message: 'Failed to add address', data: null })
    }
  }

  // Get all addresses
  static async getAddresses(req: AuthRequest, res: Response) {
    try {
      const userId = (req.authUser)?.id

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found', data: null })
      }

      const addresses = await prisma.address.findMany({ where: { userId } })

      return res
        .status(200)
        .json({
          success: true,
          message: 'Addresses retrieved successfully',
          data: addresses || [],
        })
    } catch (error) {
      console.error('Get addresses error:', error)
      return res
        .status(500)
        .json({
          success: false,
          message: 'Failed to get addresses',
          data: null,
        })
    }
  }

  // Update address
  static async updateAddress(req: AuthRequest, res: Response) {
    try {
      const userId = (req.authUser)?.id
      const addressId = req.params.addressId as string
      const {
        name,
        street,
        city,
        state,
        zipCode,
        country,
        latitude,
        longitude,
        isDefault,
      } = req.body

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found', data: null })
      }

      const address = await prisma.address.findFirst({
        where: { id: addressId, userId },
      })
      if (!address) {
        return res
          .status(404)
          .json({ success: false, message: 'Address not found', data: null })
      }

      // If setting as default, remove default from other addresses
      if (isDefault) {
        await prisma.address.updateMany({
          where: { userId, id: { not: addressId } },
          data: { isDefault: false },
        })
      }

      // Update address fields
      await prisma.address.update({
        where: { id: addressId },
        data: {
          name: name !== undefined ? name : address.name,
          street: street !== undefined ? street : address.street,
          city: city !== undefined ? city : address.city,
          state: state !== undefined ? state : address.state,
          zipCode: zipCode !== undefined ? zipCode : address.zipCode,
          country: country !== undefined ? country : address.country,
          latitude: latitude !== undefined ? latitude : address.latitude,
          longitude: longitude !== undefined ? longitude : address.longitude,
          isDefault: isDefault !== undefined ? isDefault : address.isDefault,
        },
      })

      const addresses = await prisma.address.findMany({ where: { userId } })

      return res
        .status(200)
        .json({
          success: true,
          message: 'Address updated successfully',
          data: addresses,
        })
    } catch (error) {
      console.error('Update address error:', error)
      return res
        .status(500)
        .json({
          success: false,
          message: 'Failed to update address',
          data: null,
        })
    }
  }

  // Delete address
  static async deleteAddress(req: AuthRequest, res: Response) {
    try {
      const userId = (req.authUser)?.id
      const addressId = req.params.addressId as string

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found', data: null })
      }

      const address = await prisma.address.findFirst({
        where: { id: addressId, userId },
      })

      if (!address) {
        return res
          .status(404)
          .json({ success: false, message: 'Address not found', data: null })
      }

      await prisma.address.delete({ where: { id: addressId } })

      // If deleted address was default and there are remaining addresses, set first as default
      if (address.isDefault) {
        const remaining = await prisma.address.findFirst({ where: { userId } })
        if (remaining) {
          await prisma.address.update({
            where: { id: remaining.id },
            data: { isDefault: true },
          })
        }
      }

      const addresses = await prisma.address.findMany({ where: { userId } })

      return res
        .status(200)
        .json({
          success: true,
          message: 'Address deleted successfully',
          data: addresses,
        })
    } catch (error) {
      console.error('Delete address error:', error)
      return res
        .status(500)
        .json({
          success: false,
          message: 'Failed to delete address',
          data: null,
        })
    }
  }

  // Set default address
  static async setDefaultAddress(req: AuthRequest, res: Response) {
    try {
      const userId = (req.authUser)?.id || ""
      const addressId = req.params.addressId as string

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found', data: null })
      }

      const addressExists = await prisma.address.findFirst({
        where: { id: addressId, userId },
      })

      if (!addressExists) {
        return res
          .status(404)
          .json({ success: false, message: 'Address not found', data: null })
      }

      // Set all to false, then set target to true
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      })
      await prisma.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      })

      const addresses = await prisma.address.findMany({ where: { userId } })

      return res
        .status(200)
        .json({
          success: true,
          message: 'Default address updated successfully',
          data: addresses,
        })
    } catch (error) {
      console.error('Set default address error:', error)
      return res
        .status(500)
        .json({
          success: false,
          message: 'Failed to set default address',
          data: null,
        })
    }
  }
}
