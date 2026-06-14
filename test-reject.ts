import prisma from "./src/config/prisma";
import { rejectVendorService } from "./src/modules/vendor/services/vendor.service";

async function main() {
    // Get first suspended vendor
    const vendor = await prisma.vendor.findFirst({ where: { status: "SUSPENDED" } });
    if (!vendor) {
        console.log("No suspended vendor found");
        return;
    }
    console.log("Found vendor:", vendor.id);
    try {
        await rejectVendorService(vendor.id);
        console.log("Success deleting vendor!");
    } catch(err) {
        console.error("Error from service:", err);
    }
}
main().catch(console.error);
