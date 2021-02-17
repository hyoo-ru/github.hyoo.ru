namespace $.$$ {
	
	export class $hyoo_github_compare extends $.$hyoo_github_compare {

		@ $mol_mem
		project_ids( next? : string[] ) : string[] {
			const arg = this.$.$mol_state_arg.value( 'projects' , next?.join( ',' ) )

			return arg?.split( ',' ) ?? []
		}

		projects() {
			return this.project_ids().map( id => this.Project( id ) )
		}

		project_id( index : number , next? : string ) {
			let ids = this.project_ids()
			if( next !== undefined ) {
				ids = [ ... ids.slice( 0 , index ) , next ,  ... ids.slice( index + 1 ) ].filter( v => v )
				ids = [ ... new Set( ids ) ]
				ids = this.project_ids( ids )
			}
			return ids[ index ] || ''
		}
		
		add( next: string ) {
			
			if( next ) this.project_ids([
				... new Set([
					... this.project_ids(), next
				])
			])
			
			return ''
		}
		
		remove( id: string ) {
			const ids = new Set( this.project_ids() )
			ids.delete( id )
			this.project_ids([ ... ids ])
		}

		id( id: string ) {
			return id
		}

		uri_project( id: string ) {
			return 'https://api.github.com/repos/' + id
		}
		
		uri_issues( id: string ) {
			return this.uri_project( id ) + '/issues?per_page=100'
		}
		
		@ $mol_mem_key
		project( id: string ) {
			
			return this.$.$mol_shared.daily( id, ()=> {
				
				const res = this.$.$mol_fetch.json( this.uri_project( id ) ) as any
				
				return {
					open_issues_count: res.open_issues_count as number,
					homepage: res.homepage as string,
				}
				
			} )
			
		}

		homepage( id: string ) {
			return this.project( id ).homepage || this.repo( id )
		}

		repo( id: string ) {
			return 'https://github.com/' + id
		}
		
		issues_link( id: string ) {
			return this.repo( id ) + '/issues'
		}
		
		issues_count( id: string ) {
			return this.project( id ).open_issues_count
		}

		@ $mol_mem
		issues_max() {
			return this.project_ids().reduce( ( max, id )=> {
				try {
					return Math.max( max, this.issues_count( id ) )
				} catch( error ) {
					return max
				}
			} , 0 )
		}
		
		issues_portion( id: string ) {
			return this.issues_count( id ) / this.issues_max()
		}
		
		@ $mol_mem_key
		issues_page( { id, page } : { id: string, page: number } ) {
			return this.$.$mol_fetch.json( this.uri_issues( id ) + '&page=' + page ) as {
				created_at : string
			}[]
		}

		@ $mol_mem_key
		issues( id: string ) {
			return this.$.$mol_range2(
				index => this.issues_page({ id, page: Math.floor( index / 100 ) })[ index % 100 ] ,
				()=> this.project( id ).open_issues_count
			)
		}

		@ $mol_mem_key
		capacity( id: string ) {
			
			return this.$.$mol_shared.daily( id + '/capacity', ()=> {
				
				const now = new this.$.$mol_time_moment
				
				return this.issues( id ).reduce( ( sum , issue )=> {
					
					const age = new this.$.$mol_time_interval({
						start: issue.created_at,
						end: now,
					})
					
					return sum + Math.ceil( age.duration.count( 'P1D' ) )
					
				} , 0 )
				
			} )

		}
		
		capacity_text( id: string ) {
			return this.capacity( id ).toLocaleString() + ' days'
		}
		
		@ $mol_mem
		capacity_max() {
			return this.project_ids().reduce( ( max, id )=> {
				try {
					return Math.max( max, this.capacity( id ) )
				} catch( error ) {
					return max
				}
			} , 0 )
		}
		
		capacity_portion( id: string ) {
			return this.capacity( id ) / this.capacity_max()
		}
		
		@ $mol_mem
		add_suggest() {
			
			const query = this.Add().filter_pattern()
			if( !query ) return []
			
			this.$.$mol_wait_timeout( 1000 )
			
			return this.$.$mol_shared.daily( 'repo=' + query, ()=> {
				
				const uri = `https://api.github.com/search/repositories?q=${ encodeURIComponent( query ) }`
				const res = this.$.$mol_fetch.json( uri ) as { items: { full_name: string }[] }
				
				return res.items.map( repo => repo.full_name )
			} )
			
		}

	}
	
}
