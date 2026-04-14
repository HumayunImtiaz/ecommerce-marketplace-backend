import { Request, Response } from 'express'
import User from '../models/user.model'

type AuthRequest = Request & {
  authUser?: any
}

export class AddressService {
  // Add a new address
  static async addAddress(req: AuthRequest, res: Response) {
    try {
      const userId = (req.authUser)?._id
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

      const user = await User.findById(userId)
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found', data: null })
      }

      // If this is the first address or isDefault is true, make it default
      const shouldBeDefault =
        isDefault || !user.addresses || user.addresses.length === 0

      // If setting as default, remove default from other addresses
      if (shouldBeDefault && user.addresses) {
        user.addresses = user.addresses.map((addr) => ({
          ...addr,
          isDefault: false,
        }))
      }

      // Add new address
      const newAddress = {
        _id: undefined,
        name: name || 'Home',
        street,
        city,
        state: state || '',
        zipCode: zipCode || '',
        country: country || 'Pakistan',
        latitude,
        longitude,
        isDefault: shouldBeDefault,
      }

      user.addresses = user.addresses || []
      user.addresses.push(newAddress as any)

      await user.save()

      return res
        .status(201)
        .json({
          success: true,
          message: 'Address added successfully',
          data: user.addresses,
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
      const userId = (req.authUser)?._id

      const user = await User.findById(userId).select('addresses')
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found', data: null })
      }

      return res
        .status(200)
        .json({
          success: true,
          message: 'Addresses retrieved successfully',
          data: user.addresses || [],
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
      const userId = (req.authUser)?._id
      const { addressId } = req.params
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

      const user = await User.findById(userId)
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found', data: null })
      }

      const address = user.addresses?.find(
        (addr) => addr._id?.toString() === addressId
      )
      if (!address) {
        return res
          .status(404)
          .json({ success: false, message: 'Address not found', data: null })
      }

      // If setting as default, remove default from other addresses
      if (isDefault) {
        user.addresses = user.addresses.map((addr) => ({
          ...addr,
          isDefault: addr._id?.toString() === addressId,
        }))
      }

      // Update address fields
      if (name !== undefined) address.name = name
      if (street !== undefined) address.street = street
      if (city !== undefined) address.city = city
      if (state !== undefined) address.state = state
      if (zipCode !== undefined) address.zipCode = zipCode
      if (country !== undefined) address.country = country
      if (latitude !== undefined) address.latitude = latitude
      if (longitude !== undefined) address.longitude = longitude
      if (isDefault !== undefined) address.isDefault = isDefault

      await user.save()

      return res
        .status(200)
        .json({
          success: true,
          message: 'Address updated successfully',
          data: user.addresses,
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
      const userId = (req.authUser)?._id
      const { addressId } = req.params

      const user = await User.findById(userId)
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found', data: null })
      }

      const addressIndex = user.addresses?.findIndex(
        (addr) => addr._id?.toString() === addressId
      )

      if (addressIndex === -1 || addressIndex === undefined) {
        return res
          .status(404)
          .json({ success: false, message: 'Address not found', data: null })
      }

      const wasDefault = user.addresses![addressIndex].isDefault
      user.addresses?.splice(addressIndex, 1)

      // If deleted address was default and there are remaining addresses, set first as default
      if (wasDefault && user.addresses && user.addresses.length > 0) {
        user.addresses[0].isDefault = true
      }

      await user.save()

      return res
        .status(200)
        .json({
          success: true,
          message: 'Address deleted successfully',
          data: user.addresses,
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
      const userId = (req.authUser)?._id
      const { addressId } = req.params

      const user = await User.findById(userId)
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found', data: null })
      }

      const addressExists = user.addresses?.some(
        (addr) => addr._id?.toString() === addressId
      )

      if (!addressExists) {
        return res
          .status(404)
          .json({ success: false, message: 'Address not found', data: null })
      }

      // Set all to false, then set target to true
      user.addresses = user.addresses?.map((addr) => ({
        ...addr,
        isDefault: addr._id?.toString() === addressId,
      }))

      await user.save()

      return res
        .status(200)
        .json({
          success: true,
          message: 'Default address updated successfully',
          data: user.addresses,
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
