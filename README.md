# 🔒 End-to-End Drug Tracking Blockchain

Welcome to a revolutionary system for combating counterfeit medicines in developing countries! This project uses the Stacks blockchain and Clarity smart contracts to provide transparent, immutable tracking of pharmaceuticals from manufacturing to consumer, ensuring authenticity and reducing health risks from fake drugs.

## ✨ Features

📦 Register drug batches with unique identifiers and manufacturing details  
🔍 Immutable logging of every supply chain step for full traceability  
🏭 Manufacturer verification to ensure only authorized entities create batches  
🚚 Secure transfers between distributors, retailers, and end-users  
✅ Consumer-facing verification to check drug authenticity via QR codes or hashes  
🚨 Recall mechanisms for quick identification and removal of faulty batches  
📈 Regulatory dashboards for oversight and compliance reporting  
🛡️ Prevention of tampering or duplicate entries through cryptographic proofs  

## 🛠 How It Works

This system involves 8 smart contracts written in Clarity, each handling a specific aspect of the drug supply chain to ensure security and efficiency.

### Smart Contracts Overview

1. **UserRegistry**: Manages registration and verification of all participants (manufacturers, distributors, retailers, regulators) with roles and permissions.  
2. **BatchCreation**: Allows manufacturers to create new drug batches, recording details like ingredients, production date, and unique hash.  
3. **QualityAssurance**: Logs quality control tests and certifications, requiring approvals before batches can proceed.  
4. **SupplyChainTransfer**: Handles ownership transfers along the chain, updating logs immutably at each step (e.g., from manufacturer to distributor).  
5. **InventoryManagement**: Tracks stock levels and locations for distributors and retailers to prevent overstocking or shortages.  
6. **ConsumerVerification**: Enables end-users or pharmacies to verify a drug's history by querying its batch ID or hash.  
7. **RecallSystem**: Allows regulators or manufacturers to flag batches for recall, notifying all holders and blocking further transfers.  
8. **AuditTrail**: Provides a read-only, comprehensive log of all actions across the system for audits and investigations.

**For Manufacturers**  
- Register your entity via UserRegistry.  
- Use BatchCreation to generate a new batch with a SHA-256 hash of production data.  
- Submit QA results through QualityAssurance for approval.  

**For Distributors/Retailers**  
- Verify incoming batches using ConsumerVerification.  
- Record transfers with SupplyChainTransfer to update ownership.  
- Manage stock via InventoryManagement for real-time tracking.  

**For Consumers/Pharmacies**  
- Scan a QR code or enter a batch ID to call ConsumerVerification and view the full history.  
- Report issues that could trigger RecallSystem alerts.  

**For Regulators**  
- Access AuditTrail for oversight.  
- Initiate recalls or enforce compliance through RecallSystem.  

That's it! With blockchain's immutability, every step is tamper-proof, helping save lives by ensuring only genuine medicines reach patients in developing countries.