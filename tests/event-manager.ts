import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EventManager } from "../target/types/event_manager";
import { BN } from "bn.js"
import { Keypair, PublicKey, } from '@solana/web3.js';
import {createMint, createFundedWallet, createAssociatedTokenAccount} from './utils/index' 
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { assert } from "chai";


describe("event-manager", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env();

  const program = anchor.workspace.EventManager as Program<EventManager>;


  // event account address

  let acceptedMint: PublicKey;

  //PDA's
  let eventPublicKey: PublicKey;
  let eventMint: PublicKey;
  let treasuryVault: PublicKey;
  let gainVault: PublicKey;

  //Provider (event organizer) wallet

  let walletAcceptedMintATA: PublicKey; //provider wallet accepted mint ATA

  // Sponsor
  let alice: Keypair; // alice key pair
  let aliceAcceptedMintATA: PublicKey; // alice accepted mint ATA
  let aliceEventMintATA: PublicKey; // alice event mint ATA

  // Sponsor-2
  let bob: Keypair; // BOB key pair
  let bobAcceptedMintATA: PublicKey; // BOB accepted mint ATA
  let bobEventMintATA: PublicKey; // BOB event mint ATA

  before(async () => {
    // Create a new event account
    acceptedMint =  await createMint(provider);

    //find event account PDA 
    [eventPublicKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("event", "utf-8"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );


    // find event mint account PDA
    [eventMint] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("event_mint", "utf-8"), eventPublicKey.toBuffer()],
      program.programId
    );
    
    // find event mint account PDA
    [treasuryVault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_vault", "utf-8"), eventPublicKey.toBuffer()],
      program.programId
    );

    // find gain vault account PDA

    [gainVault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("gain_vault", "utf-8"), eventPublicKey.toBuffer()],
      program.programId
    );

    alice = await createFundedWallet(provider, 3);

    // create alice accepted mint ata ed min
    // accepted mint = USDC -> alice wallet = 100 USDC
    aliceAcceptedMintATA = await createAssociatedTokenAccount(provider, acceptedMint, 500, alice);
    // find alice event mint ata
    aliceEventMintATA =  await getAssociatedTokenAddress(eventMint, alice.publicKey);

    // find provided (event organizer) wallet accepted mint ata
    //only the address
    walletAcceptedMintATA =  await getAssociatedTokenAddress(acceptedMint, provider.wallet.publicKey)

    bob = await createFundedWallet(provider, 3);

    // create bob accepted mint ata ed min
    // accepted mint = USDC -> bob wallet = 100 USDC
    bobAcceptedMintATA = await createAssociatedTokenAccount(provider, acceptedMint, 900, bob);
    // find bob event mint ata
    bobEventMintATA =  await getAssociatedTokenAddress(eventMint, bob.publicKey);


  });

  it("Test event!", async () => {

    // event test data 
    const name:string = "my_event";
    const ticketPrice = new BN(2);

    // Add your test here.
    const tx = await program.methods.createEvent(name, ticketPrice)
    .accounts({
      event: eventPublicKey,
      acceptedMint: acceptedMint,
      eventMint: eventMint,
      treasuryVault: treasuryVault,
      gainVault: gainVault,
      authority: provider.wallet.publicKey,

    })
    .rpc()

    // show new event info 
    const eventAccount = await program.account.event.fetch(eventPublicKey);
    console.log("Event info: ", eventAccount);
  });

  // TEST: Sponsor event

  it("Alice Should get 5 event tokens", async () => {

      // show alice accepted mint (USDC) ATA info
    // shound have 100 USDC
    let aliceUSDCBalance = await getAccount(
      provider.connection,
      aliceEventMintATA // aqui recibe tokens del evento
    )
    console.log("Alice event mint ATA info: ", aliceUSDCBalance);

    const quantity = new BN(5); // 5 USDC
 
    await program.methods
      .sponsorEvent(quantity)
      .accounts({
        eventMint: eventMint, //  1:! with USDC
        payerAcceptedMintAta: aliceAcceptedMintATA, // cuenta con  USDC
        event: eventPublicKey,
        authority: alice.publicKey,
        payerEventMintAta :  aliceEventMintATA, // Alice Event Mint Account
        treasuryVault: treasuryVault
      })
      .signers([alice])
      .rpc();

      // show alice event mint ATA info

      const aliceAccount = await getAccount(
        provider.connection, 
        aliceEventMintATA // aqui recibe los tokens del evento
      );
      console.log("Alice Event Mint ATA info: ", aliceAccount);
  })


      // TEST: Sponsor event

  it("bob Should get 48 event tokens", async () => {

    // show bob event mint ATA info
    let bobUSDCBalance = await getAccount(
      provider.connection,
      bobEventMintATA // aqui recibe tokens del evento
    )
    console.log("bob event mint ATA info: ", bobUSDCBalance);

    const quantity = new BN(48); // 5 USDC
    await program.methods
      .sponsorEvent(quantity)
      .accounts({
        eventMint: eventMint, //  1:! with USDC
        payerAcceptedMintAta: bobAcceptedMintATA, // cuenta con  USDC
        event: eventPublicKey,
        authority: bob.publicKey,
        payerEventMintAta :  bobEventMintATA, // bob Event Mint Account
        treasuryVault: treasuryVault
      })
      .signers([bob])
      .rpc();

      // show bob event mint ATA info

      const bobAccount = await getAccount(
        provider.connection, 
        bobEventMintATA // aqui recibe los tokens del evento
      );
      console.log("bob Event Mint ATA info: ", bobAccount);
  })



  // TEST: Buy tickets

  it("Alice buy 23 event tickets", async () => {

    // show alice event mint ATA info
    let aliceUSDCBalance = await getAccount(
      provider.connection,
      aliceEventMintATA // aqui recibe tokens del evento
    )
    console.log("Alice event mint ATA info: ", aliceUSDCBalance);

    const quantity = new BN(23); // 5 USDC
    await program.methods
      .buyTickets(quantity) // 23 tickets
      .accounts({
        payerAcceptedMintAta: aliceAcceptedMintATA, // - 4 Accepted mint (USDC)
        event: eventPublicKey,
        authority: alice.publicKey,
        gainVault: gainVault
      })
      .signers([alice])
      .rpc();

      // show event gain vault info
      const gainVaultAccount = await getAccount(
        provider.connection, 
        gainVault // aqui recibe los tokens del evento
      );
      console.log("Event gain vault: ", gainVaultAccount.amount);
      console.log("Alice event mint ATA info: ", aliceUSDCBalance);
  });
  

  // TEST: Buy tickets

  it("bob buy 154 event tickets", async () => {

    // show bob event mint ATA info
    let bobUSDCBalance = await getAccount(
      provider.connection,
      bobEventMintATA // aqui recibe tokens del evento
    )
    console.log("bob event mint ATA info: ", bobUSDCBalance);

    const quantity = new BN(154); // 5 USDC
    await program.methods
      .buyTickets(quantity) // 23 tickets
      .accounts({
        payerAcceptedMintAta: bobAcceptedMintATA, // - 4 Accepted mint (USDC)
        event: eventPublicKey,
        authority: bob.publicKey,
        gainVault: gainVault
      })
      .signers([bob])
      .rpc();

      // show event gain vault info
      const gainVaultAccount = await getAccount(
        provider.connection, 
        gainVault // aqui recibe los tokens del evento
      );
      console.log("Event gain vault: ", gainVaultAccount.amount);
      console.log("bob event mint ATA info: ", bobUSDCBalance);
  });

      // TEST: Withdraw Funds
  it("Event organizer should withdraw 1 from treasury", async () => {
    // show event treasury vault info
     // should have 5 USDC
     let treasuryVaultAccount = await getAccount(
       provider.connection,
       treasuryVault
     );
     console.log("Event treasury vault total before: ", treasuryVaultAccount.amount);
 
     const amount = new BN(1); // 1 USDC
     await program.methods
       .withdrawFunds(amount)
       .accounts({
         event: eventPublicKey,
         acceptedMint: acceptedMint, // example: USDC
         authority: provider.wallet.publicKey, // event organizer
         treasuryVault: treasuryVault, // stores all Accepted Mint (USDC) from sponsorships
         authotiryAcceptedMintAta: walletAcceptedMintATA, // account where the event organizer receives accepted mint(USDC)
       })
       .rpc();
     
     // show event treasury vault info
     // should have 4 (5-1) USDC
     treasuryVaultAccount = await getAccount(
       provider.connection,
       treasuryVault
     );
     console.log("Event treasury vault total after: ", treasuryVaultAccount.amount);
 
     // show event organizer accepted mint (USDC) ATA info
     // should have 1 accepted mint (USDC) 
     const organizerUSDCBalance = await getAccount(
       provider.connection,
       walletAcceptedMintATA // event organizer Accepted mint account (USDC account)
     );
     console.log("Organizer USDC amount: ", organizerUSDCBalance.amount);
 
   });
 


      // TEST: Close Event
      it("event organizer should close event", async () => {
        //act
        await program.methods
        .closeEvent()
        .accounts({
          event: eventPublicKey,
          authority: provider.wallet.publicKey,
        })
        .rpc()

        // show new event info
        const eventAccount = await program.account.event.fetch(eventPublicKey);
        console.log("Event is active: ", eventAccount.active);
      });

      // TEST:  Can't buy 2 Tickets
      it("Alice can't buy tickets", async () => {
        
        let error:  anchor.AnchorError;
        const quantity =  new BN(2);
        try{
          await program.methods
            .buyTickets(quantity)
            .accounts({
              payerAcceptedMintAta: aliceAcceptedMintATA,
              event: eventPublicKey, authority: alice.publicKey,
              gainVault: gainVault
            })
            .signers([alice])
            .rpc();

        } catch (err) {
          error = err;
        }
        assert.equal(error.error.errorCode.code, "EventClosed");
        console.log("You can't buy tickets, the Event is already closed");
      });
      

      // Test: Withdraw earnings
      it("Alice should withdraw earnings", async () =>{

        // show total sponsorships
        const eventAccount = await program.account.event.fetch(eventPublicKey);
        console.log("Event total sponsorships: ", eventAccount.sponsors.toNumber())

        // show event gain vault amount
        let gainVaultAccount =  await getAccount(
          provider.connection,
          gainVault,
        )
        console.log("Event Gain Vault amount: ", gainVaultAccount.amount);

        // show Alice sponsorship tokens
        let aliceTokens =  await getAccount(
          provider.connection,
          aliceEventMintATA
        );
        console.log("Alice sponsorship tokens: ", aliceTokens.amount);

        await program.methods
        .withdrawEarnings()
        .accounts({
          userEventMintAta: aliceEventMintATA,
          event: eventPublicKey,
          authority: alice.publicKey,
          gainVault: gainVault,
          userAcceptedMintAta: aliceAcceptedMintATA,
          eventMint: eventMint
        })
        .signers([alice])
        .rpc();


      // show event gain vault amount
      gainVaultAccount =  await getAccount(
        provider.connection,
        gainVault
      );
      console.log("Event Gain Vault amount: ", gainVaultAccount.amount);
      });
});
