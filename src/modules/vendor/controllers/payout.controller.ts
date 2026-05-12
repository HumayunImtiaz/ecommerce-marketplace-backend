import { Request, Response } from "express";
import prisma from "../../../config/prisma";
import { requestPayout } from "../services/payout.service";
import mailTransporter from "../../../config/mail";

// ─── Vendor Endpoints ────────────────────────────────────────────────────────

export const getVendorPayoutHistory = async (req: Request, res: Response) => {
  try {
    const vendorId = String((req as any).vendorId || "");
    const history = await prisma.payoutRequest.findMany({
      where: { vendorId },
      orderBy: { requestedAt: "desc" }
    });

    const earnings = await prisma.vendorEarning.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, data: { history, earnings } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createPayoutRequest = async (req: Request, res: Response) => {
  try {
    const vendorId = String((req as any).vendorId || "");
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const payout = await requestPayout(vendorId, Number(amount));
    res.json({ success: true, data: payout, message: "Payout requested successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── Admin Endpoints ─────────────────────────────────────────────────────────

export const getAllPayoutRequests = async (req: Request, res: Response) => {
  try {
    const payouts = await prisma.payoutRequest.findMany({
      include: {
        vendor: {
          include: { user: { select: { fullName: true, email: true } } }
        }
      },
      orderBy: { requestedAt: "desc" }
    });
    res.json({ success: true, data: payouts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approvePayout = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payout = await prisma.payoutRequest.findUnique({
      where: { id },
      include: { vendor: { include: { user: true } } }
    });

    if (!payout) return res.status(404).json({ success: false, message: "Payout not found" });
    if (payout.status === "PAID") return res.status(400).json({ success: false, message: "Already paid" });

    const updated = await prisma.payoutRequest.update({
      where: { id },
      data: { status: "PAID", resolvedAt: new Date() }
    });

    // Send Confirmation Email
    if (payout.vendor.user?.email) {
      await mailTransporter.sendMail({
        from: process.env.MAIL_FROM || `"LuxaCart Finance" <${process.env.MAIL_USER}>`,
        to: payout.vendor.user.email,
        subject: `Payout Confirmed: ${payout.amount} - LuxaCart`,
        html: `
          <div style="font-family: 'Playfair Display', serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 24px; background-color: #ffffff; color: #002147;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="font-size: 28px; font-weight: 900; margin: 0;">LuxaCart Finance</h2>
              <div style="width: 40px; hieght: 2px; background: #eb9a05; margin: 10px auto;"></div>
            </div>
            
            <div style="background-color: #f8fafc; padding: 30px; border-radius: 20px; text-align: center; border: 1px solid #f1f5f9;">
              <p style="font-size: 16px; margin-bottom: 10px; color: #64748b;">Payment Processed</p>
              <h3 style="font-size: 32px; font-weight: 900; margin: 0;">Rs. ${Number(payout.amount).toLocaleString()}</h3>
            </div>

            <div style="margin-top: 30px; line-height: 1.6;">
              <p>Hello <strong>${payout.vendor.businessName}</strong>,</p>
              <p style="font-size: 16px;">
                Humien batate hue khushi ho rahi hai ke aapka payout of <strong>Rs. ${Number(payout.amount).toLocaleString()}</strong> process ho gaya hai.
              </p>
              <p>
                Ye rakam aap ke registered bank account mein 1-3 business days mein muntakil ho jayegi.
              </p>
            </div>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
              Agar aap ko koi sawal ho to hamari support team se rabta karein.<br/>
              © ${new Date().getFullYear()} LuxaCart Marketplace. All rights reserved.
            </div>
          </div>
        `
      }).catch(e => console.error("Payout Email failed:", e.message));
    }

    res.json({ success: true, data: updated, message: "Payout marked as PAID" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
