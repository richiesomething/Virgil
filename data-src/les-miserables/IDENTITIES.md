# Identities and aliases in Les Misérables (read before writing any chapter, cast or note)

Hugo often shows a character under a new name before telling the reader who they are. Use the id for the name the
**reader** knows at that point. The reveals stage fixes the exact chapters; until then follow this table, and when the
text itself tells the reader who someone is, switch ids from that chapter on.

| Reader knows them as | id | Where | Who they turn out to be (never say before the text does) |
|---|---|---|---|
| Jean Valjean | `jean-valjean` | Vol. I Bk II onward (ch 15–39), and again from Vol. II onward wherever the narrator names him | — |
| M. Madeleine / Father Madeleine, mayor of M. sur M. | `monsieur-madeleine` | Vol. I Bk V–VII (ch 40–56) | Jean Valjean; the narrator says so in Vol. I Bk VII ch 3 "A Tempest in a Skull" (ch 57). From ch 57 use `jean-valjean`. |
| Ultime Fauchelevent (at the convent) | `jean-valjean` | Vol. II Bk VIII | The narrator is explicit that this is Valjean's assumed name: no separate id. |
| M. Leblanc, "the white-haired man" at the Luxembourg | `monsieur-leblanc` | ch 188–219, as seen by Marius | Jean Valjean. Plain to the reader at ch 220 (Thénardier: the Lark, Montfermeil, Christmas 1823). From 220 use `jean-valjean`. Until then the notes may say Marius does not know who he is; nothing more. |
| Mlle Lanoire / "Ursule" / the girl at the Luxembourg | `the-girl-at-the-luxembourg` | ch 188–219, Marius's view | Cosette; plain at ch 220 with Leblanc. From 220 use `cosette`. |
| Jondrette / Fabantou (the Gorbeau neighbour; first named at ch 159 as the gamin's father) | `jondrette` | ch 159–219 | Thénardier; he names himself in Vol. III Bk VIII ch 20 "The Trap" (ch 220). From ch 220 use `thenardier`. |
| the elder / younger Jondrette girl at the Gorbeau house | `the-elder-jondrette-girl`, `the-younger-jondrette-girl` (stand-ins) | ch 202–220 | Éponine and Azelma; Javert names them at ch 221, from where use `eponine` / `azelma`. |
| Madame Jondrette | `madame-jondrette` (stand-in) | ch 159–219 | Madame Thénardier, from 220. |
| the man in the yellow coat (the stranger at Montfermeil) | `the-man-in-the-yellow-coat` (stand-in) | ch 97–102 | Jean Valjean, from 103. |
| the Thénardiers' little boy at the inn | `the-thenardiers-little-boy` (stand-in) | ch 93, 100 | Gavroche, from 222. |
| the young workman at the barricade | `the-young-workman` (stand-in) | ch 276–292 | Éponine, from 293. |
| the tall man of the Rue des Billettes | `the-man-of-the-rue-des-billettes` (stand-in) | ch 276–282 | Javert, from 283. |
| the gamin | `gavroche` | Vol. III Bk I; the narrator names him in Bk I ch 13 and tells us whose son he is there | — |
| Monseigneur Bienvenu, the Bishop of D— | `bishop-myriel` | Vol. I Bk I–II | — |
| Petit-Gervais, Champmathieu, Fantine, Cosette (as the Lark at Montfermeil: `cosette`), Javert, Fauchelevent, Sister Simplice, Tholomyès, Marius, M. Gillenormand, Mlle Gillenormand, Théodule, Colonel Pontmercy, M. Mabeuf, Enjolras, Combeferre, Courfeyrac, Prouvaire, Feuilly, Bahorel, Bossuet (Lesgle), Joly, Grantaire, Montparnasse, Babet, Gueulemer, Claquesous, Brujon, Magnon, Azelma, Toussaint, Mother Innocente, Madame Victurnien, Bamatabois | plain kebab-case ids of those names | | |

Other rules:
- Hugo's digressions (Waterloo, the convent, argot, the sewers, the barricade history) are chapters too: summarise what they say and why Hugo put them here, without tying them to events the reader hasn't reached.
- The reader reaches a chapter's events in order; Hugo often tells them out of order within a book (e.g. "what had taken place the same night"): keep knowledge to what the text has stated by the end of the chapter.
- Chapter titles are in `source/titles.json` (the chapter files have no headings). Books and volumes are in `book.json` (`volumes` = Hugo's 48 Books, `parts` = the 5 Volumes); a chapter's `volume` field is its Book number (1–48).

The roster (`roster.json`) is the source of truth for ids and first chapters; check it before inventing an id.
